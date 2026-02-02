import TelegramBot from 'node-telegram-bot-api';
import { db } from '../../../../packages/db/src';
import { systemSettings } from '../../../../packages/db/src';
import { eq } from 'drizzle-orm';

type AlertType = 'error' | 'complete' | 'progress';

class TelegramService {
    private bot: TelegramBot | null = null;
    private chatId: string | null = null;
    private initialized = false;

    /**
     * Initialize Telegram bot with credentials from database
     */
    async initialize() {
        try {
            const tokenSetting = await db.query.systemSettings.findFirst({
                where: eq(systemSettings.key, 'telegram_bot_token')
            });

            const chatIdSetting = await db.query.systemSettings.findFirst({
                where: eq(systemSettings.key, 'telegram_chat_id')
            });

            if (tokenSetting?.value && chatIdSetting?.value) {
                this.bot = new TelegramBot(tokenSetting.value, { polling: false });
                this.chatId = chatIdSetting.value;
                this.initialized = true;
                console.log('✅ Telegram service initialized');
            } else {
                console.log('⚠️  Telegram bot not configured');
            }
        } catch (error) {
            console.error('❌ Failed to initialize Telegram service:', error);
        }
    }

    /**
     * Send alert to Telegram
     */
    async sendAlert(type: AlertType, message: string) {
        if (!this.bot || !this.chatId) {
            console.log(`[Telegram disabled] ${type}: ${message}`);
            return;
        }

        try {
            // Check if alerts are enabled
            const alertsEnabled = await this.isAlertsEnabled();
            if (!alertsEnabled) {
                return;
            }

            // Check if specific alert type is enabled
            const alertTypeEnabled = await this.isAlertTypeEnabled(type);
            if (!alertTypeEnabled) {
                return;
            }

            const emoji = { error: '❌', complete: '✅', progress: '📊' };
            const formattedMessage = `${emoji[type]} *Auto-Crawl Alert*\n\n${message}`;

            await this.bot.sendMessage(this.chatId, formattedMessage, {
                parse_mode: 'Markdown'
            });

            console.log(`📱 Telegram alert sent: ${type}`);
        } catch (error: any) {
            console.error('❌ Failed to send Telegram alert:', error.message);
        }
    }

    /**
     * Test connection
     */
    async testConnection(token: string, chatId: string): Promise<{ success: boolean; message: string }> {
        try {
            const testBot = new TelegramBot(token, { polling: false });
            await testBot.sendMessage(chatId, '✅ Telegram bot connection successful!\n\nYour bot is ready to send alerts.');

            return { success: true, message: 'Connection successful!' };
        } catch (error: any) {
            return { success: false, message: `Connection failed: ${error.message}` };
        }
    }

    /**
     * Format error alert message
     */
    formatErrorAlert(workTitle: string, chapterNumber: number, error: string, jobId: number): string {
        return `
*Crawl Error*

Truyện: ${workTitle}
Chapter: ${chapterNumber}
Lỗi: ${error}
Job ID: #${jobId}

Action: Quá trình crawl đã dừng lại. Vui lòng kiểm tra admin panel.
        `.trim();
    }

    /**
     * Format progress alert message
     */
    formatProgressAlert(workTitle: string, completed: number, total: number, jobId: number): string {
        const percentage = ((completed / total) * 100).toFixed(1);
        return `
*Progress Update*

Truyện: ${workTitle}
Hoàn thành: ${completed}/${total} (${percentage}%)
Job ID: #${jobId}

Tiếp tục crawl...
        `.trim();
    }

    /**
     * Format complete alert message
     */
    formatCompleteAlert(workTitle: string, total: number, failed: number, jobId: number, duration: string): string {
        return `
*Crawl Completed!* 🎉

Truyện: ${workTitle}
Chapters: ${total}/${total} ✓
Failed: ${failed}
Thời gian: ${duration}
Job ID: #${jobId}

Tất cả chapters đã được tóm tắt thành công!
        `.trim();
    }

    /**
     * Check if alerts are enabled globally
     */
    private async isAlertsEnabled(): Promise<boolean> {
        const setting = await db.query.systemSettings.findFirst({
            where: eq(systemSettings.key, 'telegram_alerts_enabled')
        });
        return setting?.value === 'true';
    }

    /**
     * Check if specific alert type is enabled
     */
    private async isAlertTypeEnabled(type: AlertType): Promise<boolean> {
        const key = `telegram_alert_on_${type}`;
        const setting = await db.query.systemSettings.findFirst({
            where: eq(systemSettings.key, key)
        });
        return setting?.value === 'true';
    }
}

export const telegramService = new TelegramService();
