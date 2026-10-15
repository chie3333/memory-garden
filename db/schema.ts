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
    index('idx_memories_source_type_created_at').on(
      table.sourceType,
      table.createdAt,
    ),
  ],
);

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export const memoryImages = sqliteTable(
  'memory_images',
  {
    id: text('id').primaryKey(),
    memoryId: text('memory_id').references(() => memories.id, {
      onDelete: 'cascade',
    }),
    objectKey: text('object_key').notNull().unique(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size', { mode: 'number' }).notNull(),
    ocrModel: text('ocr_model').notNull(),
    ocrText: text('ocr_text').notNull(),
    correctedText: text('corrected_text'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    confirmedAt: integer('confirmed_at', { mode: 'number' }),
  },
  (table) => [
    index('idx_memory_images_memory_id').on(table.memoryId),
    index('idx_memory_images_created_at').on(table.createdAt),
  ],
);

export type MemoryImage = typeof memoryImages.$inferSelect;
export type NewMemoryImage = typeof memoryImages.$inferInsert;
