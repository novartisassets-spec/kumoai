import { logger } from '../utils/logger';
import fs from 'fs';

export interface OutboundMessage {
    to: string;
    body: string;
    schoolId: string; // ✅ MULTI-TENANCY: Mandatory school context
    type?: 'text' | 'group_add' | 'document' | 'image';
    groupId?: string;
    documentPath?: string;
    documentCaption?: string;
    imagePath?: string;
    imageCaption?: string;
    quotedMessageId?: string; // ✅ For quoting/replying to messages in groups
}

export type MessageHandler = (msg: OutboundMessage) => Promise<void>;

export class MessengerService {
    private static instance: MessengerService;
    private handler?: MessageHandler;

    public static getInstance(): MessengerService {
        if (!MessengerService.instance) {
            MessengerService.instance = new MessengerService();
        }
        return MessengerService.instance;
    }

    /**
     * Registers the transport-layer (Baileys) send method.
     */
    public registerHandler(handler: MessageHandler) {
        this.handler = handler;
    }

    /**
     * Sends an unsolicited text message to a user.
     * @param schoolId - Mandatory school context
     * @param quotedMessageId - Optional message ID to quote/reply to (for group messages)
     */
    public async sendPush(schoolId: string, to: string, body: string, quotedMessageId?: string): Promise<void> {
        if (!schoolId) {
            throw new Error('CRITICAL: schoolId is mandatory for sendPush');
        }
        if (!this.handler) {
            logger.warn({ to, schoolId }, 'No messenger handler registered. Message queued or dropped.');
            return;
        }
        await this.handler({ schoolId, to, body, type: 'text', quotedMessageId });
        logger.info({ to, schoolId, hasQuote: !!quotedMessageId }, 'Proactive message sent');
    }

    /**
     * Sends a PDF document to a user via WhatsApp
     * @param schoolId - Mandatory school context
     * @param quotedMessageId - Optional message ID to quote/reply to (for group messages)
     */
    public async sendDocument(schoolId: string, to: string, documentPath: string, caption?: string, quotedMessageId?: string): Promise<void> {
        if (!schoolId) {
            throw new Error('CRITICAL: schoolId is mandatory for sendDocument');
        }
        if (!this.handler) {
            logger.warn({ to, schoolId, documentPath }, 'No messenger handler registered. Document not sent.');
            return;
        }

        if (!fs.existsSync(documentPath)) {
            logger.error({ to, schoolId, documentPath }, 'Document file does not exist');
            throw new Error(`Document not found: ${documentPath}`);
        }

        await this.handler({ 
            schoolId,
            to, 
            body: caption || '', 
            type: 'document',
            documentPath,
            documentCaption: caption,
            quotedMessageId
        });
        logger.info({ to, schoolId, documentPath, hasQuote: !!quotedMessageId }, 'PDF document sent');
    }

    /**
     * Sends an image to a user via WhatsApp
     */
    public async sendImage(schoolId: string, to: string, imagePath: string, caption?: string, quotedMessageId?: string): Promise<void> {
        if (!schoolId) {
            throw new Error('CRITICAL: schoolId is mandatory for sendImage');
        }
        if (!this.handler) {
            logger.warn({ to, schoolId, imagePath }, 'No messenger handler registered. Image not sent.');
            return;
        }

        if (!fs.existsSync(imagePath)) {
            logger.error({ to, schoolId, imagePath }, 'Image file does not exist');
            throw new Error(`Image not found: ${imagePath}`);
        }

        await this.handler({ 
            schoolId,
            to, 
            body: caption || '', 
            type: 'image',
            imagePath,
            imageCaption: caption,
            quotedMessageId
        });
        logger.info({ to, schoolId, imagePath, hasQuote: !!quotedMessageId }, 'Image sent');
    }

    /**
     * Triggers a group addition request.
     */
    public async addToGroup(schoolId: string, phone: string, groupId: string): Promise<void> {
        if (!schoolId) {
            throw new Error('CRITICAL: schoolId is mandatory for addToGroup');
        }
        if (!this.handler) {
            logger.warn({ phone, schoolId, groupId }, 'No messenger handler for group add.');
            return;
        }
        await this.handler({ schoolId, to: phone, body: '', type: 'group_add', groupId });
        logger.info({ phone, schoolId, groupId }, 'Group add request dispatched');
    }
}

export const messenger = MessengerService.getInstance();