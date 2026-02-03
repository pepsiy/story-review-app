import { pgTable, text, serial, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Bảng Tác phẩm (Truyện)
export const works = pgTable('works', {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(), // URL friendly ID
    title: text('title').notNull(),
    author: text('author'),
    coverImage: text('cover_image'), // URL ảnh bìa
    genre: text('genre'), // Thể loại
    description: text('description'), // Giới thiệu ngắn
    views: integer('views').default(0), // Lượt xem
    isHot: boolean('is_hot').default(false), // Truyện hot
    status: text('status').default('ONGOING'), // ONGOING, COMPLETED, DROPPED
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
    return {
        slugIdx: index('slug_idx').on(table.slug),
    };
});

// Bảng Chương
export const chapters = pgTable('chapters', {
    id: serial('id').primaryKey(),
    workId: integer('work_id').references(() => works.id).notNull(),
    chapterNumber: integer('chapter_number').notNull(),
    title: text('title'),

    // Nội dung gốc (BẢO MẬT - Không public ra frontend trực tiếp)
    originalText: text('original_text'),

    // Nội dung AI viết lại (Public cho người đọc)
    aiText: text('ai_text'),

    // Video Youtube (Nếu có)
    youtubeId: text('youtube_id'),

    // Phạm vi chương gốc (e.g., "1,5" = tóm tắt từ chương 1 đến 5 của bản gốc)
    sourceChapterRange: text('source_chapter_range'),

    summary: text('summary'), // Tóm tắt ngắn

    status: text('status').default('DRAFT'), // DRAFT, PUBLISHED
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
    return {
        workIdIdx: index('work_id_idx').on(table.workId),
    };
});

// Bảng Review
export const reviews = pgTable('reviews', {
    id: serial('id').primaryKey(),
    workId: integer('work_id').references(() => works.id).notNull(),
    content: text('content').notNull(),
    rating: integer('rating'), // 1-5 sao
    createdAt: timestamp('created_at').defaultNow(),
});

// Bảng Thể loại (Dynamic Genres)
export const genres = pgTable('genres', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
});

// Bảng Cấu hình Hệ thống (System Settings)
export const systemSettings = pgTable('system_settings', {
    key: text('key').primaryKey(), // e.g., 'GEMINI_API_KEY'
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Bảng SEO Meta (Dùng chung cho cả Work và Chapter)
export const seoMeta = pgTable('seo_meta', {
    id: serial('id').primaryKey(),
    entityType: text('entity_type').notNull(), // 'WORK' | 'CHAPTER'
    entityId: integer('entity_id').notNull(),
    title: text('title'), // Thẻ title tùy chỉnh
    description: text('description'), // Meta description
    ogImage: text('og_image'), // Ảnh share FB/Zalo
}, (table) => {
    return {
        entityIdx: index('entity_idx').on(table.entityType, table.entityId),
    };
});

// Relations
export const worksRelations = relations(works, ({ many }) => ({
    chapters: many(chapters),
    comments: many(comments), // Add relation
    favorites: many(favorites),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
    work: one(works, {
        fields: [chapters.workId],
        references: [works.id],
    }),
    comments: many(comments), // Add relation
}));

// --- AUTH & SOCIAL SCHEMA ---

// Adapter for NextAuth (Auth.js)
// Reference: https://authjs.dev/reference/adapter/drizzle

export const users = pgTable("user", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    bio: text("bio"), // Giới thiệu bản thân
    role: text("role").default("user"), // user | admin
    gold: integer("gold").default(100), // Tiền tệ trong game
    cultivationLevel: text("cultivation_level").default("Phàm Nhân"), // Cảnh giới: Phàm Nhân, Luyện Khí, Trúc Cơ...
    cultivationExp: integer("cultivation_exp").default(0), // Điểm tu vi
});

export const accounts = pgTable(
    "account",
    {
        userId: text("userId")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        type: text("type").notNull(),
        provider: text("provider").notNull(),
        providerAccountId: text("providerAccountId").notNull(),
        refresh_token: text("refresh_token"),
        access_token: text("access_token"),
        expires_at: integer("expires_at"),
        token_type: text("token_type"),
        scope: text("scope"),
        id_token: text("id_token"),
        session_state: text("session_state"),
    },
    (account) => ({
        compoundKey: index('account_provider_idx').on(account.provider, account.providerAccountId),
    })
);

export const sessions = pgTable("session", {
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
    "verificationToken",
    {
        identifier: text("identifier").notNull(),
        token: text("token").notNull(),
        expires: timestamp("expires", { mode: "date" }).notNull(),
    },
    (verificationToken) => ({
        // compositePk: primaryKey({ columns: [verificationToken.identifier, verificationToken.token] }),
        // Drizzle specific composite key handling might differ slightly, using unique index for now or standard comp key
        compositeIdx: index('verification_token_idx').on(verificationToken.identifier, verificationToken.token)
    })
);

// Comments Table
export const comments = pgTable('comments', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    workId: integer('work_id').references(() => works.id), // Comment on a Work (optional)
    chapterId: integer('chapter_id').references(() => chapters.id), // Comment on a Chapter (optional)
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

// Chat Messages Table
export const chatMessages = pgTable('chat_messages', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    isFlagged: boolean('is_flagged').default(false), // Cho kiểm duyệt
});

// Bảng Yêu thích (Favorites/Library)
export const favorites = pgTable('favorites', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    workId: integer('work_id').references(() => works.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
    return {
        userWorkIdx: index('user_work_idx').on(table.userId, table.workId), // Unique checking optimization
    };
});



// --- GAME SYSTEM ---

// Bảng Kho đồ (Inventory)
export const inventory = pgTable('inventory', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    itemId: text('item_id').notNull(), // 'seed_carrot', 'herb_linh_thao'
    quantity: integer('quantity').default(0).notNull(),
    type: text('type').notNull(), // 'SEED', 'PRODUCT', 'CONSUMABLE'
}, (table) => {
    return {
        userItemIdx: index('user_item_idx').on(table.userId, table.itemId),
    };
});

// Bảng Đất trồng (Farm Plots)
export const farmPlots = pgTable('farm_plots', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    plotIndex: integer('plot_index').notNull(), // 0-8 (3x3 grid)
    isUnlocked: boolean('is_unlocked').default(false),
    seedId: text('seed_id'), // null = empty
    plantedAt: timestamp('planted_at'), // null = not planted
}, (table) => {
    return {
        userPlotIdx: index('user_plot_idx').on(table.userId, table.plotIndex),
    };
});

// Bảng Định nghĩa Vật phẩm Game (Dynamic Config)
export const gameItems = pgTable('game_items', {
    id: text('id').primaryKey(), // 'seed_linh_thao'
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').notNull(), // 'SEED', 'PRODUCT', 'CONSUMABLE'

    // Config values
    price: integer('price').default(0), // Giá mua
    sellPrice: integer('sell_price').default(0), // Giá bán
    growTime: integer('grow_time').default(0), // Thời gian trồng (giây)
    exp: integer('exp').default(0), // Exp nhận được (khi trồng hoặc dùng)

    // Yield (Harvest Quantity)
    minYield: integer('min_yield').default(1),
    maxYield: integer('max_yield').default(1),

    // Visual
    icon: text('icon'), // Emoji or URL

    // Recipe (cho Luyện đan) - JSON Array: [{ "itemId": "herb_a", "quantity": 10 }]
    ingredients: text('ingredients'), // JSON stringified
});

// Bảng Nhiệm Vụ (Mission/Quest Definitions)
export const missions = pgTable('missions', {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),

    // Requirements
    minCultivation: text('min_cultivation'), // e.g., 'Phàm Nhân'

    // Type: 'COLLECT' (nộp vật phẩm), 'HUNT' (chưa có), 'SYSTEM' (đăng nhập)
    type: text('type').default('COLLECT').notNull(),

    // Config for COLLECT
    requiredItemId: text('required_item_id'),
    requiredQuantity: integer('required_quantity').default(1),

    // Rewards
    rewardGold: integer('reward_gold').default(0),
    rewardExp: integer('reward_exp').default(0),
    rewardItems: text('reward_items'), // JSON: [{ "itemId": "pill_x", "quantity": 1 }]

    createdAt: timestamp('created_at').defaultNow(),
});

// Bảng Theo dõi Nhiệm vụ người dùng (User Missions)
export const userMissions = pgTable('user_missions', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    missionId: integer('mission_id').references(() => missions.id, { onDelete: 'cascade' }).notNull(),

    status: text('status').default('IN_PROGRESS'), // IN_PROGRESS, COMPLETED, FAILED
    progress: integer('progress').default(0), // Count for collection/kills

    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
}, (table) => {
    return {
        userMissionIdx: index('user_mission_idx').on(table.userId, table.status),
    };
});

// Bảng Hảo Cảm / Quan Hệ Xã Hội (Friendship)
export const friendships = pgTable('friendships', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

    friendshipLevel: integer('friendship_level').default(0), // Hảo cảm
    lastInteraction: timestamp('last_interaction').defaultNow(),

    // Counters
    waterCount: integer('water_count').default(0), // Số lần tưới
    stealCount: integer('steal_count').default(0), // Số lần trộm
}, (table) => {
    return {
        userTargetIdx: index('user_target_idx').on(table.userId, table.targetUserId),
    };
});

// ==================== AUTO-CRAWL SYSTEM ====================

// Bảng Crawl Jobs - Quản lý các công việc crawl
export const crawlJobs = pgTable('crawl_jobs', {
    id: serial('id').primaryKey(),
    workId: integer('work_id').references(() => works.id, { onDelete: 'cascade' }),
    sourceUrl: text('source_url').notNull(), // https://truyenfull.vision/tien-nghich

    // Status
    status: text('status').notNull().default('initializing'),
    // 'initializing' | 'crawling' | 'ready' | 'processing' | 'paused' | 'completed' | 'failed'

    // Progress
    totalChapters: integer('total_chapters').default(0),
    crawledChapters: integer('crawled_chapters').default(0),
    summarizedChapters: integer('summarized_chapters').default(0),
    failedChapters: integer('failed_chapters').default(0),

    // Auto mode
    autoMode: boolean('auto_mode').default(false),
    batchSize: integer('batch_size').default(5),

    // Merge settings
    chaptersPerSummary: integer('chapters_per_summary').default(1),
    targetStartChapter: integer('target_start_chapter'), // Optional range start
    targetEndChapter: integer('target_end_chapter'),     // Optional range end

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    lastProcessedAt: timestamp('last_processed_at'),

    // Error tracking
    lastError: text('last_error'),
}, (table) => {
    return {
        workIdIdx: index('crawl_job_work_idx').on(table.workId),
        statusIdx: index('crawl_job_status_idx').on(table.status),
    };
});

// Bảng Crawl Chapters - Chi tiết từng chapter
export const crawlChapters = pgTable('crawl_chapters', {
    id: serial('id').primaryKey(),
    jobId: integer('job_id').references(() => crawlJobs.id, { onDelete: 'cascade' }),
    workId: integer('work_id').references(() => works.id, { onDelete: 'cascade' }),

    // Chapter info
    chapterNumber: integer('chapter_number').notNull(),
    title: text('title'),
    sourceUrl: text('source_url').notNull(),

    // Content
    rawContent: text('raw_content'), // HTML content đã crawl
    summary: text('summary'), // AI summary

    // Status
    status: text('status').notNull().default('pending'),
    // 'pending' | 'crawling' | 'crawled' | 'summarizing' | 'completed' | 'failed'

    // Error handling
    retryCount: integer('retry_count').default(0),
    error: text('error'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    crawledAt: timestamp('crawled_at'),
    summarizedAt: timestamp('summarized_at'),
}, (table) => {
    return {
        jobChapterIdx: index('crawl_chapter_job_idx').on(table.jobId, table.chapterNumber),
        statusIdx: index('crawl_chapter_status_idx').on(table.status),
    };
});

export const usersRelations = relations(users, ({ many }) => ({
    comments: many(comments),
    chatMessages: many(chatMessages),
    favorites: many(favorites),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
    user: one(users, {
        fields: [comments.userId],
        references: [users.id],
    }),
    work: one(works, {
        fields: [comments.workId],
        references: [works.id],
    }),
    chapter: one(chapters, {
        fields: [comments.chapterId],
        references: [chapters.id],
    }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
    user: one(users, {
        fields: [chatMessages.userId],
        references: [users.id],
    }),
}));
