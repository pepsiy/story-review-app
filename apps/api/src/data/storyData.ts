export type StoryStep = {
    id: number;
    type: 'DIALOGUE' | 'COMBAT' | 'MISSION' | 'REWARD';
    title?: string;
    content?: string; // Dialogue text or description
    speaker?: string; // NPC Name
    speakerImage?: string; // NPC Image URL

    // Requirements (for simple steps, or check before advancing)
    requiredLevel?: string;
    requiredItem?: string;
    requiredMissionId?: number;

    // Combat
    combatEnemyId?: string;

    // Rewards
    rewards?: { gold?: number, exp?: number, items?: { itemId: string, quantity: number }[] };
};

export type StoryChapter = {
    id: string; // 'chapter_1'
    title: string;
    description: string;
    steps: StoryStep[];
};

export const STORIES: Record<string, StoryChapter> = {
    'chapter_1': {
        id: 'chapter_1',
        title: 'Chương 1: Khởi Đầu Tại Thanh Vân',
        description: 'Bước đầu tiên trên con đường tu tiên đầy gian nan.',
        steps: [
            {
                id: 0,
                type: 'DIALOGUE',
                speaker: 'Trưởng Lão Thanh Vân',
                speakerImage: 'https://img.freepik.com/premium-photo/old-chinese-man-with-long-white-beard-traditional-clothes_950002-12599.jpg',
                content: 'Khụ khụ... Ngươi đã tỉnh rồi sao? Ta nhặt được ngươi ngất xỉu dưới chân núi.'
            },
            {
                id: 1,
                type: 'DIALOGUE',
                speaker: 'Trưởng Lão Thanh Vân',
                speakerImage: 'https://img.freepik.com/premium-photo/old-chinese-man-with-long-white-beard-traditional-clothes_950002-12599.jpg',
                content: 'Nhìn cốt cách của ngươi cũng không tệ, có muốn gia nhập Thanh Vân Môn ta để tu luyện không?'
            },
            {
                id: 2,
                type: 'DIALOGUE',
                speaker: 'Hệ Thống',
                content: 'Bạn đã đồng ý gia nhập Thanh Vân Môn. Chúc mừng bạn bước vào con đường Tu Tiên!'
            },
            {
                id: 3,
                type: 'REWARD',
                title: 'Quà Nhập Môn',
                content: 'Trưởng Lão tặng bạn một ít lộ phí và hạt giống để bắt đầu.',
                rewards: {
                    gold: 100,
                    items: [
                        { itemId: 'seed_linh_thao', quantity: 5 },
                        { itemId: 'weapon_wood_sword', quantity: 1 }
                    ]
                }
            },
            {
                id: 4,
                type: 'DIALOGUE',
                speaker: 'Trưởng Lão Thanh Vân',
                speakerImage: 'https://img.freepik.com/premium-photo/old-chinese-man-with-long-white-beard-traditional-clothes_950002-12599.jpg',
                content: 'Hãy cầm lấy thanh Mộc Kiếm này. Sắp tới ngươi hãy thử ra sau núi luyện tập với vài con Sói Hoang xem sao.'
            },
            // Step 5: Require Combat
            {
                id: 5,
                type: 'COMBAT',
                title: 'Thử Thách Đầu Tiên',
                content: 'Đánh bại 1 con Sói Hoang để chứng tỏ bản lĩnh!',
                combatEnemyId: 'beast_wolf'
            },
            {
                id: 6,
                type: 'DIALOGUE',
                speaker: 'Trưởng Lão Thanh Vân',
                speakerImage: 'https://img.freepik.com/premium-photo/old-chinese-man-with-long-white-beard-traditional-clothes_950002-12599.jpg',
                content: 'Khá lắm! Ngươi có tiềm năng đó. Hãy tiếp tục tu luyện, ta sẽ còn gặp lại ngươi.'
            },
            {
                id: 7,
                type: 'REWARD',
                title: 'Hoàn Thành Chương 1',
                content: 'Bạn đã hoàn thành chương mở đầu.',
                rewards: {
                    gold: 500,
                    exp: 100
                }
            }
        ]
    }
};
