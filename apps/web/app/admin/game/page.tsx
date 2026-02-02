"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash } from "lucide-react";

type GameItem = {
    id: string;
    name: string;
    description?: string;
    type: 'SEED' | 'PRODUCT' | 'CONSUMABLE';
    price: number;
    sellPrice: number;
    growTime: number;
    exp: number;
    minYield: number;
    maxYield: number;
    icon: string;
    ingredients?: string; // JSON string
};

const DEFAULT_ITEM: GameItem = {
    id: '',
    name: '',
    type: 'PRODUCT',
    price: 0,
    sellPrice: 0,
    growTime: 0,
    exp: 0,
    minYield: 1,
    maxYield: 1,
    icon: '📦',
    ingredients: '',
};

export default function AdminGamePage() {
    const [items, setItems] = useState<GameItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState<GameItem | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const fetchItems = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/game-items`);
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } catch (error) {
            toast.error("Lỗi tải danh sách vật phẩm");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleSave = async () => {
        if (!editingItem || !editingItem.id) return toast.error("Cần nhập ID vật phẩm");

        try {
            const res = await fetch(`${API_URL}/admin/game-items/${editingItem.id}`, {
                method: "POST", // Upsert
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingItem)
            });

            if (res.ok) {
                toast.success("Đã lưu vật phẩm");
                setEditingItem(null);
                fetchItems();
            } else {
                toast.error("Lỗi khi lưu");
            }
        } catch (error) {
            toast.error("Lỗi kết nối");
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Quản lý Vật phẩm Game (Dynamic Config)</h1>
                <Button onClick={() => setEditingItem({ ...DEFAULT_ITEM })} className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" /> Thêm Vật Phẩm
                </Button>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* List */}
                <div className="col-span-12 md:col-span-4 bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">Danh sách</div>
                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                        {items.map(item => (
                            <div
                                key={item.id}
                                className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors flex items-center justify-between ${editingItem?.id === item.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                                onClick={() => setEditingItem(item)}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{item.icon}</span>
                                    <div>
                                        <div className="font-medium text-sm">{item.name}</div>
                                        <div className="text-xs text-slate-400">{item.id}</div>
                                    </div>
                                </div>
                                <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{item.type}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Edit Form */}
                <div className="col-span-12 md:col-span-8">
                    {editingItem ? (
                        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                {items.find(i => i.id === editingItem.id) ? 'Chỉnh sửa' : 'Thêm mới'}
                                <span className="font-mono text-slate-500 text-sm">({editingItem.id})</span>
                            </h2>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">ID (Mã định danh)</label>
                                    <Input
                                        value={editingItem.id}
                                        onChange={e => setEditingItem({ ...editingItem, id: e.target.value })}
                                        disabled={!!items.find(i => i.id === editingItem.id)} // Disable edit ID if exists
                                        placeholder="seed_apple"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tên Vật Phẩm</label>
                                    <Input
                                        value={editingItem.name}
                                        onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                        placeholder="Hạt Táo"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Icon (Emoji)</label>
                                    <Input
                                        value={editingItem.icon || ''}
                                        onChange={e => setEditingItem({ ...editingItem, icon: e.target.value })}
                                        placeholder="🍎"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Loại</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
                                        value={editingItem.type}
                                        onChange={e => setEditingItem({ ...editingItem, type: e.target.value as any })}
                                    >
                                        <option value="SEED">Hạt Giống (SEED)</option>
                                        <option value="PRODUCT">Sản Phẩm (PRODUCT)</option>
                                        <option value="CONSUMABLE">Tiêu Thụ (Pill)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mb-4 bg-slate-50 p-4 rounded text-sm">
                                <div>
                                    <label className="block font-medium mb-1">Giá Mua</label>
                                    <Input type="number" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="block font-medium mb-1">Giá Bán</label>
                                    <Input type="number" value={editingItem.sellPrice} onChange={e => setEditingItem({ ...editingItem, sellPrice: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="block font-medium mb-1">Exp (Dùng)</label>
                                    <Input type="number" value={editingItem.exp} onChange={e => setEditingItem({ ...editingItem, exp: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="block font-medium mb-1">TG Trồng (s)</label>
                                    <Input type="number" value={editingItem.growTime} onChange={e => setEditingItem({ ...editingItem, growTime: parseInt(e.target.value) || 0 })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4 bg-green-50 p-4 rounded text-sm">
                                <div>
                                    <label className="block font-medium mb-1">Sản lượng Min</label>
                                    <Input type="number" value={editingItem.minYield} onChange={e => setEditingItem({ ...editingItem, minYield: parseInt(e.target.value) || 1 })} />
                                </div>
                                <div>
                                    <label className="block font-medium mb-1">Sản lượng Max</label>
                                    <Input type="number" value={editingItem.maxYield} onChange={e => setEditingItem({ ...editingItem, maxYield: parseInt(e.target.value) || 1 })} />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Mô tả</label>
                                <Textarea
                                    value={editingItem.description || ''}
                                    onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-1">Công thức (JSON Ingredients)</label>
                                <Textarea
                                    className="font-mono text-xs h-24"
                                    value={editingItem.ingredients || ''}
                                    onChange={e => setEditingItem({ ...editingItem, ingredients: e.target.value })}
                                    placeholder='[{ "itemId": "herb_a", "quantity": 10 }]'
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Lưu ý: Phải là JSON hợp lệ nếu nhập.</p>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditingItem(null)}>Hủy</Button>
                                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                                    <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow border border-slate-200 p-10 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                            <div className="text-4xl mb-4">👈</div>
                            <p>Chọn một vật phẩm để chỉnh sửa hoặc nhấn "Thêm Vật Phẩm"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
