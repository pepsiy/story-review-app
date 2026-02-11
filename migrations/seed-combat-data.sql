-- Phase 33: Seed Data for Combat Skills
-- Populate initial skills, skill books, and enemy skill mappings

-- ==============================
-- TIER 1: PHÀM CẤP (Common) - Basic Skills
-- ==============================

-- FIRE Element Skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('fire_spark_t1', 'Hỏa Hoa', 'Tung một tia lửa nhỏ', 'pham', 'fire', 10, 0, 120, NULL, 'fire_basic', 0),
('fire_ball_t2', 'Hỏa Cầu', 'Ném một quả cầu lửa', 'huyen', 'fire', 20, 1, 170, NULL, 'fire_medium', 2),
('fire_storm_t3', 'Liệt Diệm', 'Triệu hồi bão lửa', 'dia', 'fire', 40, 2, 250, '[{"type":"buff","stat":"attack","value":10,"duration":2}]', 'fire_storm', 5);

-- WATER Element Skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('water_stream_t1', 'Thủy Lưu', 'Dòng nước nhỏ tấn công', 'pham', 'water', 10, 0, 115, NULL, 'water_basic', 0),
('water_wave_t2', 'Thủy Đao', 'Gợn sóng chém địch', 'huyen', 'water', 20, 1, 165, '[{"type":"debuff","stat":"dodge","value":-5,"duration":2}]', 'water_wave', 2),
('water_dragon_t3', 'Thủy Long', 'Triệu hồi rồng nước', 'dia', 'water', 45, 3, 280, NULL, 'water_dragon', 5);

-- WIND Element Skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('wind_blade_t1', 'Phong Nhận', 'Lưỡi gió nhọn', 'pham', 'wind', 8, 0, 125, NULL, 'wind_basic', 0),
('wind_slash_t2', 'Phong Kiếm', 'Chém gió xuyên giáp', 'huyen', 'wind', 18, 1, 180, NULL, 'wind_slash', 2),
('wind_storm_t3', 'Phong Bão', 'Cơn bão phá hủy', 'dia', 'wind', 50, 2, 300, '[{"type":"debuff","stat":"defense","value":-10,"duration":3}]', 'wind_storm', 5);

-- EARTH Element Skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('earth_rock_t1', 'Thạch Đầu', 'Ném đá nhỏ', 'pham', 'earth', 12, 0, 110, NULL, 'earth_basic', 0),
('earth_spike_t2', 'Thạch Chùy', 'Cột đất nhô lên', 'huyen', 'earth', 25, 2, 160, '[{"type":"buff","stat":"defense","value":15,"duration":3}]', 'earth_spike', 2),
('earth_quake_t3', 'Địa Chấn', 'Rung chuyển đất đai', 'dia', 'earth', 55, 3, 270, '[{"type":"debuff","stat":"dodge","value":-10,"duration":2}]', 'earth_quake', 5);

-- LIGHTNING Element Skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('lightning_shock_t1', 'Lôi Điện', 'Tia sét nhỏ', 'pham', 'lightning', 15, 0, 130, NULL, 'lightning_basic', 0),
('lightning_bolt_t2', 'Lôi Công', 'Chớp đánh mạnh', 'huyen', 'lightning', 30, 1, 190, '[{"type":"buff","stat":"crit_rate","value":10,"duration":2}]', 'lightning_bolt', 2),
('lightning_chain_t3', 'Lôi Liên Hoàn', 'Sét dây xích', 'dia', 'lightning', 60, 2, 320, NULL, 'lightning_chain', 5);

-- ICE Element Skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('ice_shard_t1', 'Băng Tuyết', 'Mảnh băng nhọn', 'pham', 'ice', 10, 0, 115, NULL, 'ice_basic', 0),
('ice_spike_t2', 'Băng Thủy Tinh', 'Cột băng xuyên thấu', 'huyen', 'ice', 22, 2, 175, '[{"type":"debuff","stat":"agi","value":-8,"duration":2}]', 'ice_spike', 2),
('ice_prison_t3', 'Băng Phong', 'Ngục băng giam kẻ địch', 'dia', 'ice', 50, 3, 260, '[{"type":"debuff","stat":"attack","value":-15,"duration":3}]', 'ice_prison', 5);

-- DARK Element Skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('dark_curse_t1', 'Ma Khí', 'Năng lượng tà khí', 'pham', 'dark', 13, 0, 125, NULL, 'dark_basic', 0),
('dark_slash_t2', 'Ma Giới', 'Chém tà ác', 'huyen', 'dark', 28, 1, 185, '[{"type":"debuff","stat":"defense","value":-12,"duration":2}]', 'dark_slash', 2),
('dark_void_t3', 'Ám Hắc Hổng', 'Hố đen hút linh hồn', 'dia', 'dark', 65, 3, 310, '[{"type":"buff","stat":"hp","value":-50,"duration":1}]', 'dark_void', 5);

-- LIGHT Element Skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('light_beam_t1', 'Thánh Quang', 'Tia sáng linh thiêng', 'pham', 'light', 12, 0, 120, NULL, 'light_basic', 0),
('light_burst_t2', 'Quang Diệu', 'Bùng nổ ánh sáng', 'huyen', 'light', 25, 1, 180, '[{"type":"heal","stat":"hp","value":20,"duration":1}]', 'light_burst', 2),
('light_judgment_t3', 'Thiên Phạt', 'Phán xét trời giáng', 'dia', 'light', 60, 3, 300, NULL, 'light_judgment', 5);

-- NEUTRAL Element Skills (No element advantage/disadvantage)
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('neutral_punch_t1', 'Quyền Pháp', 'Đấm thẳng cơ bản', 'pham', 'neutral', 5, 0, 110, NULL, 'neutral_basic', 0),
('neutral_combo_t2', 'Liên Hoàn Quyền', 'Đấm liên tiếp', 'huyen', 'neutral', 18, 1, 155, NULL, 'neutral_combo', 2),
('neutral_ultimate_t3', 'Thiên Hạ Vô Song', 'Tuyệt chiêu tối thượng', 'dia', 'neutral', 80, 4, 350, '[{"type":"buff","stat":"crit_damage","value":50,"duration":1}]', 'neutral_ultimate', 6);

-- ==============================
-- HIGHER TIER SKILLS (Thiên & Thần)
-- ==============================

-- THIÊN CẤP (Epic) - Rare powerful skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('fire_phoenix_t4', 'Hỏa Phượng Hoàng', 'Triệu hồi phượng hoàng lửa', 'thien', 'fire', 100, 5, 450, '[{"type":"buff","stat":"attack","value":30,"duration":3}]', 'fire_phoenix', 8),
('water_tsunami_t4', 'Thủy Áp Đảo', 'Sóng thần hủy diệt', 'thien', 'water', 110, 5, 480, NULL, 'water_tsunami', 8),
('lightning_heaven_t4', 'Thiên Lôi Trận', 'Trời sấm nứt đất', 'thien', 'lightning', 120, 4, 500, '[{"type":"buff","stat":"crit_rate","value":25,"duration":2}]', 'lightning_heaven', 8);

-- THẦN CẤP (Legendary) - Ultimate rare skills
INSERT INTO skills (id, name, description, tier, element, mana_cost, cooldown, damage_multiplier, effects, animation, cultivation_req) VALUES
('fire_god_wrath', 'Hỏa Thần Chi Nộ', 'Thần lửa giáng trần', 'than', 'fire', 200, 8, 800, '[{"type":"buff","stat":"attack","value":50,"duration":4}]', 'fire_god', 10),
('dark_abyss', 'Ma Vực Vô Tận', 'Hố đen vô tận nuốt chửng vũ trụ', 'than', 'dark', 250, 10, 1000, '[{"type":"debuff","stat":"defense","value":-50,"duration":5}]', 'dark_abyss', 10),
('light_salvation', 'Thánh Quang Cứu Thế', 'Ánh sáng cứu rỗi', 'than', 'light', 220, 8, 850, '[{"type":"heal","stat":"hp","value":200,"duration":1}]', 'light_salvation', 10);

-- ==============================
-- SKILL BOOKS (Phàm & Huyền - Drop frequently)
-- ==============================

-- Phàm Cấp Skill Books
INSERT INTO skill_books (id, skill_id, name, rarity, icon, description) VALUES
('book_fire_spark', 'fire_spark_t1', 'Bí Kíp Hỏa Hoa', 'pham', '📕', 'Học skill Hỏa Hoa cơ bản'),
('book_water_stream', 'water_stream_t1', 'Bí Kíp Thủy Lưu', 'pham', '📘', 'Học skill Thủy Lưu cơ bản'),
('book_wind_blade', 'wind_blade_t1', 'Bí Kíp Phong Nhận', 'pham', '📗', 'Học skill Phong Nhận cơ bản'),
('book_earth_rock', 'earth_rock_t1', 'Bí Kíp Thạch Đầu', 'pham', '📙', 'Học skill Thạch Đầu cơ bản'),
('book_lightning_shock', 'lightning_shock_t1', 'Bí Kíp Lôi Điện', 'pham', '📔', 'Học skill Lôi Điện cơ bản'),
('book_ice_shard', 'ice_shard_t1', 'Bí Kíp Băng Tuyết', 'pham', '📓', 'Học skill Băng Tuyết cơ bản'),
('book_dark_curse', 'dark_curse_t1', 'Bí Kíp Ma Khí', 'pham', '📒', 'Học skill Ma Khí cơ bản'),
('book_light_beam', 'light_beam_t1', 'Bí Kíp Thánh Quang', 'pham', '📖', 'Học skill Thánh Quang cơ bản'),
('book_neutral_punch', 'neutral_punch_t1', 'Bí Kíp Quyền Pháp', 'pham', '📄', 'Học skill Quyền Pháp cơ bản');

-- Huyền Cấp Skill Books
INSERT INTO skill_books (id, skill_id, name, rarity, icon, description) VALUES
('book_fire_ball', 'fire_ball_t2', 'Bí Kíp Hỏa Cầu', 'huyen', '🔥', 'Học skill Hỏa Cầu trung cấp'),
('book_water_wave', 'water_wave_t2', 'Bí Kíp Thủy Đao', 'huyen', '🌊', 'Học skill Thủy Đao trung cấp'),
('book_wind_slash', 'wind_slash_t2', 'Bí Kíp Phong Kiếm', 'huyen', '💨', 'Học skill Phong Kiếm trung cấp'),
('book_earth_spike', 'earth_spike_t2', 'Bí Kíp Thạch Chùy', 'huyen', '🪨', 'Học skill Thạch Chùy trung cấp'),
('book_lightning_bolt', 'lightning_bolt_t2', 'Bí Kíp Lôi Công', 'huyen', '⚡', 'Học skill Lôi Công trung cấp');

-- Địa Cấp Skill Books (Rare)
INSERT INTO skill_books (id, skill_id, name, rarity, icon, description) VALUES
('book_fire_storm', 'fire_storm_t3', 'Bí Kíp Liệt Diệm', 'dia', '🔥💥', 'Học skill Liệt Diệm cao cấp'),
('book_water_dragon', 'water_dragon_t3', 'Bí Kíp Thủy Long', 'dia', '🐉💧', 'Học skill Thủy Long cao cấp'),
('book_lightning_chain', 'lightning_chain_t3', 'Bí Kíp Lôi Liên Hoàn', 'dia', '⚡⚡⚡', 'Học skill Lôi Liên Hoàn cao cấp');

-- Thiên Cấp Skill Books (Epic - very rare)
INSERT INTO skill_books (id, skill_id, name, rarity, icon, description) VALUES
('book_fire_phoenix', 'fire_phoenix_t4', 'Cổ Thư Hỏa Phượng Hoàng', 'thien', '🔥🦅', 'Học skill Hỏa Phượng Hoàng tối thượng'),
('book_water_tsunami', 'water_tsunami_t4', 'Cổ Thư Thủy Áp Đảo', 'thien', '🌊🌪️', 'Học skill Thủy Áp Đảo tối thượng'),
('book_lightning_heaven', 'lightning_heaven_t4', 'Cổ Thư Thiên Lôi Trận', 'thien', '⚡☁️', 'Học skill Thiên Lôi Trận tối thượng');

-- Thần Cấp Skill Books (Legendary - ultra rare)
INSERT INTO skill_books (id, skill_id, name, rarity, icon, description) VALUES
('book_fire_god', 'fire_god_wrath', 'Thiên Thư Hỏa Thần Chi Nộ', 'than', '🔥👑', 'Học skill Hỏa Thần Chi Nộ huyền thoại'),
('book_dark_abyss', 'dark_abyss', 'Thiên Thư Ma Vực Vô Tận', 'than', '🌑👁️', 'Học skill Ma Vực Vô Tận huyền thoại'),
('book_light_salvation', 'light_salvation', 'Thiên Thư Thánh Quang Cứu Thế', 'than', '✨👼', 'Học skill Thánh Quang Cứu Thế huyền thoại');

-- ==============================
-- ENEMY SKILLS MAPPING
-- ==============================

-- Sói Hoang (Aggressive Fire Wolf)
INSERT INTO enemy_skills (enemy_id, skill_id, usage_rate, min_turn) VALUES
('beast_wolf', 'fire_spark_t1', 40, 1),
('beast_wolf', 'fire_ball_t2', 20, 3);

-- Hổ Sơn Lâm (Earth Tiger - Defensive)
INSERT INTO enemy_skills (enemy_id, skill_id, usage_rate, min_turn) VALUES
('beast_tiger', 'earth_rock_t1', 35, 1),
('beast_tiger', 'earth_spike_t2', 25, 2);

-- Rắn Độc (Poison Snake - Water/Dark)
INSERT INTO enemy_skills (enemy_id, skill_id, usage_rate, min_turn) VALUES
('beast_snake', 'water_stream_t1', 30, 1),
('beast_snake', 'dark_curse_t1', 20, 2);

-- ==============================
-- Notes:
-- ==============================
-- 1. Damage multiplier stored as integer (150 = 1.5x)
-- 2. Effects stored as JSON string
-- 3. Cultivation requirement: 0 = Luyện Khí, 2 = Trúc Cơ, 5 = Kim Đan, etc.
-- 4. Enemy skill usage_rate: Probability (0-100) AI will use this skill
-- 5. Min_turn: Earliest turn enemy can use the skill

-- ===================================== 
-- Seed Complete - Ready for Combat!
-- =====================================
