import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, MessageSquare, Play } from "lucide-react";
import { toast } from "sonner";

type StoryStep = {
    id: number;
    type: string;
    title?: string;
    content?: string;
    speaker?: string;
    speakerImage?: string;
    rewards?: any;
    combatEnemyId?: string;
};

type StoryData = {
    chapterId: string;
    chapterTitle: string;
    stepIndex: number;
    step: StoryStep;
};

export default function StoryTab({ userId, onCombatStart }: { userId: string, onCombatStart: (enemyId: string) => void }) {
    const [loading, setLoading] = useState(true);
    const [story, setStory] = useState<StoryData | null>(null);
    const [showDialogue, setShowDialogue] = useState(false);
    const [finishedChapter, setFinishedChapter] = useState(false);

    const fetchProgress = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/game/story/progress?userId=${userId}`);
            const data = await res.json();
            if (data.success) {
                if (data.finishedChapter) {
                    setFinishedChapter(true);
                } else if (data.finished) {
                    setFinishedChapter(true); // No more chapters
                } else {
                    setStory(data);
                    setFinishedChapter(false);
                }
            }
        } catch (error) {
            console.error("Failed to fetch story", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProgress();
    }, [userId]);

    const handleAdvance = async () => {
        if (!story) return;

        // If COMBAT type, user must click 'Fight' which calls onCombatStart
        if (story.step.type === 'COMBAT') {
            if (story.step.combatEnemyId) {
                onCombatStart(story.step.combatEnemyId);
                return;
            }
        }

        try {
            const res = await fetch('/api/game/story/advance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await res.json();

            if (data.success) {
                if (data.rewards) {
                    toast.success("Đã nhận phần thưởng cốt truyện!");
                }
                fetchProgress(); // Refresh to next step
            } else {
                toast.error(data.message || "Không thể tiếp tục");
            }
        } catch (error) {
            toast.error("Lỗi kết nối");
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    if (finishedChapter) {
        return (
            <div className="text-center p-10 text-slate-400">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-xl font-bold text-slate-200">Hoàn Thành Chương</h3>
                <p>Bạn đã hoàn thành chương hiện tại. Hãy chờ cập nhật tiếp theo!</p>
            </div>
        );
    }

    if (!story) return <div className="p-10 text-center">Không tải được dữ liệu cốt truyện.</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <BookOpen size={120} />
                </div>

                <h2 className="text-2xl font-bold text-amber-500 mb-2">{story.chapterTitle}</h2>
                <div className="text-slate-400 text-sm mb-6">Tiến độ: Bước {story.stepIndex + 1}</div>

                <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 min-h-[200px] flex flex-col justify-center items-center text-center">
                    {story.step.type === 'DIALOGUE' && (
                        <div className="space-y-4">
                            <MessageSquare className="w-10 h-10 text-blue-400 mx-auto" />
                            <p className="text-lg text-slate-200 italic">"Có người đang muốn nói chuyện với bạn..."</p>
                            <Button onClick={() => setShowDialogue(true)} className="bg-blue-600 hover:bg-blue-700">
                                Xem Hội Thoại
                            </Button>
                        </div>
                    )}

                    {story.step.type === 'COMBAT' && (
                        <div className="space-y-4">
                            <div className="text-6xl">⚔️</div>
                            <h3 className="text-xl font-bold text-red-500">{story.step.title}</h3>
                            <p className="text-slate-300">{story.step.content}</p>
                            <Button onClick={handleAdvance} variant="destructive" className="w-full max-w-xs">
                                Chiến Đấu Ngay
                            </Button>
                        </div>
                    )}

                    {story.step.type === 'REWARD' && (
                        <div className="space-y-4">
                            <div className="text-6xl">🎁</div>
                            <h3 className="text-xl font-bold text-yellow-500">{story.step.title}</h3>
                            <p className="text-slate-300">{story.step.content}</p>
                            <Button onClick={handleAdvance} className="bg-yellow-600 hover:bg-yellow-700 w-full max-w-xs">
                                Nhận Thưởng
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* DIALOGUE MODAL */}
            {showDialogue && story.step.type === 'DIALOGUE' && (
                <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-end justify-center pb-10 sm:pb-20">
                    <div className="max-w-3xl w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10 fade-in duration-300">
                        {/* Speaker Image */}
                        {story.step.speakerImage && (
                            <div className="absolute -top-32 left-10 w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-slate-700 overflow-hidden shadow-lg bg-slate-800">
                                <img src={story.step.speakerImage} alt={story.step.speaker} className="w-full h-full object-cover" />
                            </div>
                        )}

                        <div className="mb-4 pl-0 md:pl-48">
                            <div className="text-amber-500 font-bold text-lg mb-1">{story.step.speaker || '???'}</div>
                            <div className="text-slate-200 text-lg leading-relaxed typing-effect">
                                {story.step.content}
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <Button onClick={() => {
                                setShowDialogue(false);
                                handleAdvance(); // Advance after reading
                            }} className="group">
                                Tiếp Tục <Play size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
