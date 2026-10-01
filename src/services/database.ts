import { open } from 'react-native-quick-sqlite';
import { ChatMessage, Conversation } from '../types/chat';

export class DatabaseService {
  private static db: any = null;

  static async init(): Promise<void> {
    if (this.db) return;
    this.db = open({ name: 'khittara_chat.db' });
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0
      );
    `);
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens_count INTEGER DEFAULT 0,
        tokens_per_second REAL DEFAULT 0.0,
        duration_ms INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_conv ON messages(conversation_id);`);
  }

  static async addMessage(message: ChatMessage): Promise<void> {
    await this.init();
    this.db.execute(
      `INSERT INTO messages (id, conversation_id, role, content, tokens_count, tokens_per_second, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [message.id, message.conversationId, message.role, message.content, message.tokensCount || 0, message.tokensPerSecond || 0, message.durationMs || 0, message.createdAt]
    );
  }
}