import { logger } from '../utils/logger';
import fs from 'fs';

export interface OutboundMessage {
    to: string;
    body: string;
    type?: 'text' | 'group_add' | 'document';
    groupId?: string;
    documentPath?: string;
    documentCaption?: string;
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
     * @param quotedMessageId - Optional message ID to quote/reply to (for group messages)
     */
    public async sendPush(to: string, body: string, quotedMessageId?: string): Promise<void> {
        if (!this.handler) {
            logger.warn({ to }, 'No messenger handler registered. Message queued or dropped.');
            return;
        }
        await this.handler({ to, body, type: 'text', quotedMessageId });
        logger.info({ to, hasQuote: !!quotedMessageId }, 'Proactive message sent');
    }

    /**
     * Sends a PDF document to a user via WhatsApp
     * @param quotedMessageId - Optional message ID to quote/reply to (for group messages)
     */
    public async sendDocument(to: string, documentPath: string, caption?: string, quotedMessageId?: string): Promise<void> {
        if (!this.handler) {
            logger.warn({ to, documentPath }, 'No messenger handler registered. Document not sent.');
            return;
        }

        if (!fs.existsSync(documentPath)) {
            logger.error({ to, documentPath }, 'Document file does not exist');
            throw new Error(`Document not found: ${documentPath}`);
        }

        await this.handler({ 
            to, 
            body: caption || '', 
            type: 'document',
            documentPath,
            documentCaption: caption,
            quotedMessageId
        });
        logger.info({ to, documentPath, hasQuote: !!quotedMessageId }, 'PDF document sent');
    }

    /**
     * Triggers a group addition request.
     */
    public async addToGroup(phone: string, groupId: string): Promise<void> {
        if (!this.handler) {
            logger.warn({ phone, groupId }, 'No messenger handler for group add.');
            return;
        }
        await this.handler({ to: phone, body: '', type: 'group_add', groupId });
        logger.info({ phone, groupId }, 'Group add request dispatched');
    }
}

export const messenger = MessengerService.getInstance();