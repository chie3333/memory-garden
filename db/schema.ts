import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const memories = sqliteTable(
  'memories',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    source: text('source').notNull().default('내 기록'),
    sourceType: text('source_type').notNull().default('manual'),
    sourceId: text('source_id'),
    searchText: text('search_text').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_memories_created_at').on(table.createdAt),
    index('idx_memories_source_type_created_at').on(table.sourceType, table.createdAt),
  ],
);

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
