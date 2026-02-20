import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket,
    AnyMessageContent,
    downloadMediaMessage,
    proto
} from 'baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import * as qrcode from 'qrcode-terminal';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { AgentDispatcher } from '../dispatcher';
import { MessageRouter } from '../router';
import { IncomingMessage, MessageType } from '../types';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { messenger, OutboundMessage } from '../../services/messenger';

export class WhatsAppTransport {
    private sock: WASocket | undefined;
    private dispatcher: AgentDispatcher;
    private lidMap: Map<string, string> = new Map();
    private sessionDir: string = '';
    private processedMessages: Set<string> = new Set(); // ✅ Simple deduplication cache
    
    constructor() {
        this.dispatcher = new AgentDispatcher();

        // Cleanup deduplication cache periodically
        setInterval(() => {
            if (this.processedMessages.size > 1000) {
                this.processedMessages.clear();
                logger.debug('🧹 [TRANSPORT] Cleared processed messages cache');
            }
        }, 30 * 60 * 1000); // Every 30 mins

        // ✅ REGISTER OUTBOUND HANDLER (Once)
        // Arrow function ensures 'this.sock' always refers to the current socket
        messenger.registerHandler(async (msg: OutboundMessage) => {
            if (!this.sock) {
                logger.warn('Socket not initialized, cannot send outbound message');
                return;
            }

            try {
                // Ensure target JID is properly formatted (essential for baileys)
                const targetJid = msg.to.includes('@') ? msg.to : msg.to + '@s.whatsapp.net';
                
                // Show typing indicator for outbound messages too
                await this.sock.sendPresenceUpdate('composing', targetJid);

                if (msg.type === 'text') {
                    await this.sock.sendMessage(targetJid, { text: msg.body });
                } else if (msg.type === 'document' && msg.documentPath) {
                    await this.sock.sendMessage(targetJid, {
                        document: { url: msg.documentPath },
                        mimetype: 'application/pdf',
                        fileName: path.basename(msg.documentPath),
                        caption: msg.documentCaption
                    });
                }
                
                logger.info({ to: targetJid, type: msg.type }, '📤 [TRANSPORT] Proactive outbound message delivered');
            } catch (err) {
                logger.error({ err, to: msg.to }, '❌ [TRANSPORT] Failed to send outbound message');
            }
        });
    }

    private async resolveLid(lidJid: string): Promise<string> {
        const lid = lidJid.split('@')[0];
        
        // 1. Check Memory
        if (this.lidMap.has(lid)) return this.lidMap.get(lid)! + '@s.whatsapp.net';

        // 2. Check Session Files (Reverse Mapping)
        try {
            const reverseMappingPath = path.join(this.sessionDir, `lid-mapping-${lid}_reverse.json`);
            if (fs.existsSync(reverseMappingPath)) {
                const phone = JSON.parse(fs.readFileSync(reverseMappingPath, 'utf-8'));
                if (phone) {
                    logger.info({ lid, phone }, '🔍 Resolved LID from session file');
                    this.lidMap.set(lid, phone);
                    return phone + '@s.whatsapp.net';
                }
            }
        } catch (e) {
            logger.debug({ lid, error: e }, 'Failed to read lid-mapping file');
        }

        return lidJid; // Fallback to LID if cannot resolve
    }

    /**
     * ✅ DB HELPER: Update school with group JID
     */
    private async updateSchoolGroupJid(schoolId: string, groupJid: string) {
        return new Promise<void>((resolve) => {
            db.getDB().run(
                `UPDATE schools SET whatsapp_group_jid = ? WHERE id = ? AND whatsapp_group_jid IS NULL`,
                [groupJid, schoolId],
                (err: any) => {
                    if (err) logger.error({ err, schoolId, groupJid }, 'Failed to auto-link group JID');
                    else {
                        logger.info({ schoolId, groupJid }, '🔗 [TRANSPORT] Group JID auto-linked to school');
                    }
                    resolve();
                }
            );
        });
    }

    async start() {
        // Locate auth folder
        const authBaseDir = path.resolve('kumo_auth_info');
        if (!fs.existsSync(authBaseDir)) fs.mkdirSync(authBaseDir, { recursive: true });
        
        let sessionDir = path.join(authBaseDir, 'primary_session');
        const subdirs = fs.readdirSync(authBaseDir).filter(f => fs.statSync(path.join(authBaseDir, f)).isDirectory());
        if (subdirs.length > 0) {
            sessionDir = path.join(authBaseDir, subdirs[0]);
            logger.info({ sessionDir }, 'Found existing session directory');
        }
        this.sessionDir = sessionDir;

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        logger.info({ version, isLatest }, 'Starting WhatsApp Transport');

        this.sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }) as any,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }) as any),
            },
            generateHighQualityLinkPreview: true,
        });

        this.sock.ev.on('creds.update', saveCreds);

        // ✅ Listen for history/contacts to build LID maps
        this.sock.ev.on('messaging-history.set', ({ contacts }) => {
            for (const contact of contacts) {
                if (contact.id.endsWith('@lid') && (contact as any).phoneNumber) {
                    const lid = contact.id.split('@')[0];
                    const phone = (contact as any).phoneNumber;
                    this.lidMap.set(lid, phone);
                }
            }
        });

        this.sock.ev.on('contacts.upsert', (contacts) => {
            for (const contact of contacts) {
                if (contact.id.endsWith('@lid') && (contact as any).phoneNumber) {
                    const lid = contact.id.split('@')[0];
                    const phone = (contact as any).phoneNumber;
                    this.lidMap.set(lid, phone);
                }
            }
        });

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                 logger.info('👉 QR Code received, please scan with WhatsApp:');
                 qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                logger.warn({ statusCode, error: lastDisconnect?.error, shouldReconnect }, '🔄 Connection closed');
                
                if (shouldReconnect) {
                    setImmediate(() => this.start());
                } else {
                    logger.error('❌ Connection closed permanently. User logged out.');
                }
            } else if (connection === 'open') {
                logger.info('✅ WhatsApp Connection Opened/Restored');
                
                // ✅ SEND ADMIN WELCOME MESSAGE (First Connection Only)
                this.sendAdminWelcomeMessage().catch(err => {
                    logger.error({ err }, '❌ [TRANSPORT] Error sending admin welcome message');
                });
            }
        });

        // ✅ HANDLE NEW MEMBERS (GA Greeting)
        this.sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
            if (action === 'add' && this.sock) {
                // Find school for this group
                const school: any = await new Promise((resolve) => {
                    db.getDB().get(
                        `SELECT id, name FROM schools WHERE whatsapp_group_jid = ? OR whatsapp_group_jid = ?`,
                        [id, id.split('@')[0]],
                        (err, row) => resolve(row)
                    );
                });

                if (school) {
                    for (const p of participants) {
                        const participantJid = typeof p === 'string' ? p : (p as any).id;
                        logger.info({ groupId: id, participantJid, school: school.name }, '👋 [TRANSPORT] New member detected, triggering GA greeting');
                        
                        // Resolve name if possible
                        let name = 'Parent';
                        if (participantJid.endsWith('@lid')) {
                            const resolved = await this.resolveLid(participantJid);
                            const phone = resolved.split('@')[0];
                            const user = await new Promise<any>((resolve) => {
                                db.getDB().get(`SELECT name FROM users WHERE phone = ? AND school_id = ?`, [phone, school.id], (err, row) => resolve(row));
                            });
                            if (user?.name) name = user.name;
                        }

                        const msgId = `join-${Date.now()}-${uuidv4().substring(0, 8)}`;
                        const incomingMsg: IncomingMessage = {
                            id: msgId,
                            from: id,
                            to: this.sock?.user?.id?.split('@')[0].split(':')[0],
                            type: 'text',
                            body: '[SYSTEM_EVENT] NEW_MEMBER_JOINED',
                            timestamp: Date.now(),
                            source: 'system',
                            isGroup: true,
                            participant: participantJid
                        };

                        // Inject GA task metadata
                        (incomingMsg as any).task_type = 'NEW_MEMBER';
                        (incomingMsg as any).new_member_name = name;

                        const routedMsg = await MessageRouter.route(incomingMsg);
                        
                        // ✅ Presence update for group
                        await this.sock.sendPresenceUpdate('composing', id);
                        
                        const response = await this.dispatcher.dispatch(routedMsg);
                        
                        if (response.body) {
                            await this.sock.sendMessage(id, { text: response.body });
                        }
                    }
                }
            }
        });

        this.sock.ev.on('messages.upsert', async (m) => {
            try {
                if (m.type !== 'notify') return;

                for (const msg of m.messages) {
                    if (!msg.message) continue;
                    if (msg.key.fromMe) continue; 

                    const messageType = Object.keys(msg.message)[0];
                    let from = msg.key.remoteJid!;
                    let participant = msg.key.participant || from;
                    
                    // ✅ TYPE FILTER: Ignore protocol/internal messages
                    if (messageType === 'protocolMessage' || messageType === 'senderKeyDistributionMessage') {
                        continue;
                    }

                    // ✅ DEDUPLICATION: Prevent processing same message multiple times
                    if (msg.key.id && this.processedMessages.has(msg.key.id)) {
                        logger.debug({ msgId: msg.key.id }, '⏭️ [TRANSPORT] Skipping already processed message');
                        continue;
                    }
                    if (msg.key.id) this.processedMessages.add(msg.key.id);

                    logger.info({ msgId: msg.key.id, from, type: messageType }, '📩 [TRANSPORT] New message received');

                    // ✅ LID RESOLUTION
                    if (from.endsWith('@lid')) {
                        const originalFrom = from;
                        from = await this.resolveLid(from);
                        logger.debug({ originalFrom, resolvedFrom: from }, '🔍 [TRANSPORT] LID resolved for sender');
                    }
                    if (participant.endsWith('@lid')) {
                        const originalParticipant = participant;
                        participant = await this.resolveLid(participant);
                        logger.debug({ originalParticipant, resolvedParticipant: participant }, '🔍 [TRANSPORT] LID resolved for participant');
                    }

                    let body = '';
                    let type: MessageType = 'text';
                    let mediaPath: string | undefined;

                    if (messageType === 'conversation') {
                        body = msg.message.conversation || '';
                    } else if (messageType === 'extendedTextMessage') {
                        body = msg.message.extendedTextMessage?.text || '';
                    } else if (messageType === 'imageMessage') {
                        type = 'image';
                        body = msg.message.imageMessage?.caption || '';
                        logger.info({ msgId: msg.key.id }, '🖼️ [TRANSPORT] Downloading image message...');
                        try {
                            const buffer = await downloadMediaMessage(msg, 'buffer', {});
                            const fileName = `media_${Date.now()}_${uuidv4()}.jpg`;
                            const storagePath = path.resolve('storage', 'uploads');
                            if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
                            mediaPath = path.join(storagePath, fileName);
                            await writeFile(mediaPath, buffer);
                            logger.info({ msgId: msg.key.id, mediaPath }, '✅ [TRANSPORT] Image downloaded successfully');
                        } catch (mediaErr) {
                            logger.error({ mediaErr, msgId: msg.key.id }, '❌ [TRANSPORT] Failed to download media');
                        }
                    }
                    
                    const msgId = msg.key.id || uuidv4();
                    const botJid = this.sock?.user?.id;
                    const cleanTo = botJid ? botJid.split('@')[0].split(':')[0] : undefined;

                    const incomingMsg: IncomingMessage = {
                        id: msgId,
                        from: from,
                        to: cleanTo, 
                        type,
                        body,
                        mediaPath,
                        timestamp: (msg.messageTimestamp as number) * 1000 || Date.now(),
                        source: 'user',
                        isGroup: from.endsWith('@g.us'),
                        participant: participant,
                        originalMessageKey: msg.key
                    };

                    logger.debug({ msgId, body: body.substring(0, 100) }, '🔄 [TRANSPORT] Normalizing message for router');
                    const routedMsg = await MessageRouter.route(incomingMsg);
                    logger.info({ 
                        msgId, 
                        context: routedMsg.context, 
                        schoolId: routedMsg.schoolId, 
                        role: routedMsg.identity?.role 
                    }, '🛣️ [TRANSPORT] Message routed successfully');

                    // ✅ AUTO-LINK GROUP JID
                    if (routedMsg.isGroup && routedMsg.schoolId && routedMsg.isAdminMessage) {
                        await this.updateSchoolGroupJid(routedMsg.schoolId, from);
                    }

                    // ✅ GA SILENCE RULE (Pre-dispatch Optimization)
                    const shouldShowTyping = !(routedMsg.context === 'GA' && routedMsg.isAdminMessage);

                    if (shouldShowTyping) {
                        logger.debug({ from }, '✍️ [TRANSPORT] Sending presence update: composing');
                        await this.sock!.sendPresenceUpdate('composing', from);
                    }

                    logger.info({ msgId, agent: routedMsg.context }, '🧠 [TRANSPORT] Dispatching to agent...');
                    const response = await this.dispatcher.dispatch(routedMsg);
                    
                    // ✅ DEEP AGENT RESPONSE LOGGING
                    logger.info({ 
                        msgId, 
                        agent: routedMsg.context,
                        response: {
                            replyText: response.body ? response.body.substring(0, 150) + '...' : '(empty)',
                            deliveryType: response.delivery_type || 'text',
                            action: (response as any).action || (response as any).action_required || 'NONE',
                            hasPayload: !!response.action_payload,
                            payloadSummary: response.action_payload ? JSON.stringify(response.action_payload).substring(0, 300) + '...' : 'none',
                            isEscalation: !!(response as any).admin_escalation?.required || (response as any).action_required === 'ESCALATE_TO_ADMIN',
                            escalationDetails: (response as any).admin_escalation || (response as any).escalation_payload
                        }
                    }, '🤖 [TRANSPORT] Agent response received (FULL CONTEXT)');

                    // ✅ GA SILENCE RULE (Response Enforcement)
                    if (routedMsg.context === 'GA' && routedMsg.isAdminMessage) {
                        logger.info({ msgId: incomingMsg.id }, '🔇 [TRANSPORT] GA Silence: Suppressing response to Admin in group');
                        response.body = '';
                        if (response.actions) {
                            response.actions = response.actions.filter(a => a.type !== 'SEND_MESSAGE');
                        }
                    }

                    if (response.body || response.mediaPath || response.actions) {
                        let finalBody = response.body || '';
                        
                        // ✅ FAIL-SAFE: Extract reply_text if AI returned raw JSON string
                        if (finalBody.trim().startsWith('{')) {
                            try {
                                const parsed = JSON.parse(finalBody);
                                if (parsed.reply_text) {
                                    logger.warn({ msgId: incomingMsg.id }, '⚠️ [TRANSPORT] Fail-safe: Extracted reply_text from raw JSON response');
                                    finalBody = parsed.reply_text;
                                }
                            } catch (e) {
                                // Not valid JSON, keep as is
                            }
                        }

                        const payload: AnyMessageContent = { text: finalBody };
                        
                        if (response.mediaPath) {
                            if (response.mediaPath.endsWith('.pdf')) {
                                (payload as any).document = { url: response.mediaPath };
                                (payload as any).mimetype = 'application/pdf';
                                (payload as any).fileName = path.basename(response.mediaPath);
                            } else if (response.mediaPath.match(/\.(jpg|jpeg|png)$/i)) {
                                (payload as any).image = { url: response.mediaPath };
                            }
                        }

                        const options: any = { quoted: msg }; 
                        
                        // Only send reply if there is text or media
                        if (payload.text || (payload as any).document || (payload as any).image) {
                            logger.info({ 
                                to: msg.key.remoteJid, 
                                actualText: payload.text ? payload.text.substring(0, 100) + '...' : '(media)',
                                hasMedia: !!response.mediaPath 
                            }, '📤 [TRANSPORT] Sending outbound reply');
                            await this.sock!.sendMessage(msg.key.remoteJid!, payload, options);
                        }
                        
                        if (response.actions) {
                            for (const action of response.actions) {
                                logger.info({ type: action.type, payload: action.payload }, '🛠️ [TRANSPORT] Executing backend action');
                                if (action.type === 'DELETE_MESSAGE') {
                                    if (action.payload.messageId === incomingMsg.id && msg.key.id) {
                                        logger.warn({ msgId: msg.key.id }, '🗑️ [TRANSPORT] Deleting abusive message');
                                        await this.sock!.sendMessage(msg.key.remoteJid!, { delete: msg.key });
                                    }
                                } else if (action.type === 'REMOVE_MEMBER') {
                                    const target = action.payload.targetJid || action.payload.phone;
                                    if (target) {
                                        const targetJid = target.includes('@') ? target : target + '@s.whatsapp.net';
                                        logger.warn({ groupId: from, targetJid }, '🚫 [TRANSPORT] Removing member from group');
                                        await this.sock!.groupParticipantsUpdate(from, [targetJid], 'remove');
                                    }
                                } else if (action.type === 'JOIN_GROUP') {
                                    const code = action.payload.group_code;
                                    try {
                                        logger.info({ code }, '🚀 [TRANSPORT] Joining group via invite code');
                                        const response = await this.sock!.groupAcceptInvite(code);
                                        if (response && routedMsg.schoolId) {
                                            await this.updateSchoolGroupJid(routedMsg.schoolId, response);
                                        }
                                    } catch (joinErr) {
                                        logger.error({ joinErr, code }, '❌ [TRANSPORT] Failed to join group');
                                    }
                                }
                            }
                        }
                    } else if (shouldShowTyping) {
                        logger.debug({ from }, '⏸️ [TRANSPORT] Stopping presence update: paused');
                        await this.sock!.sendPresenceUpdate('paused', from);
                    }
                }
            } catch (err) {
                logger.error({ err }, '❌ [TRANSPORT] Critical error handling message');
            }
        });
    }

    /**
     * ✅ Send welcome message to admin after WhatsApp connection opens
     * This is triggered when the QR code is scanned and connection is established
     * Now delegates to SA agent for personalized setup flow
     */
    private async sendAdminWelcomeMessage(): Promise<void> {
        try {
            // Get school and admin info
            const school: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT id, name, admin_phone, setup_status FROM schools LIMIT 1`,
                    (err: any, row: any) => {
                        if (err) {
                            logger.error({ err }, '❌ [TRANSPORT] Could not fetch school for welcome message');
                            resolve(null);
                        } else {
                            resolve(row);
                        }
                    }
                );
            });

            if (!school || !school.admin_phone) {
                logger.warn('[TRANSPORT] No school or admin phone found, cannot send welcome');
                return;
            }

            // Check if this is a fresh setup (school has PENDING_SETUP status)
            if (school.setup_status !== 'PENDING_SETUP') {
                logger.info('[TRANSPORT] School already operational, no welcome needed');
                return;
            }

            // ✅ Delegate to SA agent for personalized welcome with prefilled universe
            const { SchoolAdminAgent } = await import('../../agents/sa/index');
            await SchoolAdminAgent.sendSetupWelcome(school.id);

        } catch (error) {
            logger.error({ error }, '❌ [TRANSPORT] Failed to send admin welcome message');
        }
    }
}
