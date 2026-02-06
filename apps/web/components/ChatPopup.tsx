"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

let socket: Socket;

export function ChatPopup({ user }: { user?: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [msgInput, setMsgInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Init socket
        const URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        socket = io(URL, {
            query: { userId: user?.id }
        });

        socket.on("connect", () => {
            console.log("Connected to Chat");
            socket.emit("join_community");
        });

        socket.on("receive_message", (data) => {
            setMessages((prev) => [...prev, data]);
            scrollToBottom();
        });

        return () => {
            socket.disconnect();
        };
    }, [user?.id]);

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 100);
    };

    const handleSend = () => {
        if (!user) return alert("Vui lòng đăng nhập!");
        if (!msgInput.trim()) return;

        const data = {
            user: {
                name: user.name,
                image: user.image,
                id: user.id
            },
            content: msgInput.trim()
        };

        // Optimistic UI? No, wait for broadcast for simplicity or both.
        // socket.emit broadcast usually sends to everyone including sender depending on server logic.
        // My server logic: io.to("community").emit (sends to all).
        socket.emit("send_message", data);
        setMsgInput("");
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 md:w-96 bg-white rounded-lg shadow-2xl border border-indigo-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10">
                    {/* Header */}
                    <div className="bg-indigo-600 p-3 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">💬</span>
                            <span className="font-bold">Cộng Đồng Truyện</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">✕</button>
                    </div>

                    {/* Messages */}
                    <div className="h-80 overflow-y-auto p-4 bg-slate-50 space-y-4" ref={scrollRef}>
                        {messages.length === 0 && (
                            <p className="text-center text-xs text-slate-400 mt-20">Chào mừng bạn đến với phòng chat!</p>
                        )}
                        {messages.map((msg, idx) => {
                            const isMe = msg.user?.id === user?.id;
                            return (
                                <div key={idx} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                    <div className="flex-shrink-0">
                                        {msg.user?.image ? (
                                            <Image src={msg.user.image} alt="avt" width={24} height={24} className="rounded-full" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">
                                                {msg.user?.name?.[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`max-w-[75%] p-2 rounded-lg text-sm ${isMe ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-800'}`}>
                                        <p className="font-bold text-[10px] opacity-70 mb-0.5">{msg.user?.name}</p>
                                        <p>{msg.content}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t flex gap-2">
                        {user ? (
                            <>
                                <Input
                                    className="flex-1 text-sm h-9"
                                    placeholder="Chat gì đó..."
                                    value={msgInput}
                                    onChange={(e) => setMsgInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                />
                                <Button size="sm" className="h-9 px-3" onClick={handleSend}>➤</Button>
                            </>
                        ) : (
                            <div className="w-full text-center text-xs text-red-500 py-2 bg-red-50 rounded">
                                Đăng nhập để chat
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-xl flex items-center justify-center text-2xl transition-transform hover:scale-110"
                >
                    💬
                </Button>
            )}
        </div>
    );
}
