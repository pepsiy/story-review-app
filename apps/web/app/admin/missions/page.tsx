"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Edit, Plus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

interface Mission {
    id: string;
    title: string;
    description: string | null;
    type: string;
    requiredAction: string | null;
    requiredItemId: string | null;
    requiredQuantity: number;
    rewardGold: number;
    rewardExp: number;
    rewardItems: string | null;
}

export default function AdminMissionsPage() {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingMission, setEditingMission] = useState<Mission | null>(null);

    const [formData, setFormData] = useState({
        id: '',
        title: '',
        description: '',
        type: 'PROGRESS',
        requiredAction: '',
        requiredItemId: '',
        requiredQuantity: 1,
        rewardGold: 0,
        rewardExp: 0,
        rewardItems: ''
    });

    const fetchMissions = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/missions`);
            const data = await res.json();
            setMissions(data.missions || []);
        } catch (error) {
            console.error('Failed to fetch missions:', error);
            toast.error('Không thể tải danh sách nhiệm vụ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMissions();
    }, []);

    const handleCreate = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/missions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create');
            }

            toast.success('Tạo nhiệm vụ thành công!');
            setDialogOpen(false);
            resetForm();
            fetchMissions();
        } catch (error: any) {
            toast.error(error.message || 'Có lỗi xảy ra');
        }
    };

    const handleUpdate = async () => {
        if (!editingMission) return;

        try {
            const res = await fetch(`${API_URL}/admin/missions/${editingMission.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Failed to update');

            toast.success('Cập nhật thành công!');
            setDialogOpen(false);
            setEditingMission(null);
            resetForm();
            fetchMissions();
        } catch (error) {
            toast.error('Không thể cập nhật');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa nhiệm vụ này?')) return;

        try {
            const res = await fetch(`${API_URL}/admin/missions/${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Failed to delete');

            toast.success('Đã xóa nhiệm vụ');
            fetchMissions();
        } catch (error) {
            toast.error('Không thể xóa');
        }
    };

    const openEditDialog = (mission: Mission) => {
        setEditingMission(mission);
        setFormData({
            id: mission.id,
            title: mission.title,
            description: mission.description || '',
            type: mission.type,
            requiredAction: mission.requiredAction || '',
            requiredItemId: mission.requiredItemId || '',
            requiredQuantity: mission.requiredQuantity,
            rewardGold: mission.rewardGold,
            rewardExp: mission.rewardExp,
            rewardItems: mission.rewardItems || ''
        });
        setDialogOpen(true);
    };

    const resetForm = () => {
        setFormData({
            id: '',
            title: '',
            description: '',
            type: 'PROGRESS',
            requiredAction: '',
            requiredItemId: '',
            requiredQuantity: 1,
            rewardGold: 0,
            rewardExp: 0,
            rewardItems: ''
        });
        setEditingMission(null);
    };

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Quản Lý Nhiệm Vụ</h1>
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        resetForm();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Thêm Nhiệm Vụ
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingMission ? 'Chỉnh Sửa Nhiệm Vụ' : 'Tạo Nhiệm Vụ Mới'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>ID (Unique)</Label>
                                <Input
                                    disabled={!!editingMission}
                                    placeholder="mission_daily_example"
                                    value={formData.id}
                                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Tiêu Đề</Label>
                                <Input
                                    placeholder="Tên nhiệm vụ"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Mô Tả</Label>
                                <Textarea
                                    placeholder="Mô tả chi tiết"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Loại</Label>
                                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SYSTEM">SYSTEM (Login)</SelectItem>
                                        <SelectItem value="PROGRESS">PROGRESS (Action-based)</SelectItem>
                                        <SelectItem value="COLLECT">COLLECT (Item-based)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.type === 'PROGRESS' && (
                                <div>
                                    <Label>Hành Động (requiredAction)</Label>
                                    <Input
                                        placeholder="WATER, HARVEST, PLANT, CRAFT"
                                        value={formData.requiredAction}
                                        onChange={(e) => setFormData({ ...formData, requiredAction: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            )}
                            {formData.type === 'COLLECT' && (
                                <div>
                                    <Label>Item ID</Label>
                                    <Input
                                        placeholder="seed_carrot"
                                        value={formData.requiredItemId}
                                        onChange={(e) => setFormData({ ...formData, requiredItemId: e.target.value })}
                                    />
                                </div>
                            )}
                            <div>
                                <Label>Số Lượng Yêu Cầu</Label>
                                <Input
                                    type="number"
                                    value={formData.requiredQuantity}
                                    onChange={(e) => setFormData({ ...formData, requiredQuantity: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Thưởng Vàng</Label>
                                    <Input
                                        type="number"
                                        value={formData.rewardGold}
                                        onChange={(e) => setFormData({ ...formData, rewardGold: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <Label>Thưởng Exp</Label>
                                    <Input
                                        type="number"
                                        value={formData.rewardExp}
                                        onChange={(e) => setFormData({ ...formData, rewardExp: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <Button onClick={editingMission ? handleUpdate : handleCreate} className="w-full">
                                {editingMission ? 'Cập Nhật' : 'Tạo Nhiệm Vụ'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <p>Đang tải...</p>
            ) : (
                <div className="grid gap-4">
                    {missions.map((mission) => (
                        <Card key={mission.id} className="p-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">{mission.title}</h3>
                                    <p className="text-sm text-gray-600">{mission.description}</p>
                                    <div className="mt-2 text-xs space-y-1">
                                        <p><span className="font-semibold">ID:</span> {mission.id}</p>
                                        <p><span className="font-semibold">Type:</span> {mission.type}</p>
                                        {mission.requiredAction && <p><span className="font-semibold">Action:</span> {mission.requiredAction}</p>}
                                        {mission.requiredItemId && <p><span className="font-semibold">Item ID:</span> {mission.requiredItemId}</p>}
                                        <p><span className="font-semibold">Required:</span> {mission.requiredQuantity}</p>
                                        <p><span className="font-semibold">Rewards:</span> {mission.rewardGold} Gold + {mission.rewardExp} Exp</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="icon" onClick={() => openEditDialog(mission)}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(mission.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
