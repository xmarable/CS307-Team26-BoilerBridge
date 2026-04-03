"use client"

import { MessageSquare, Send, Plus, Image, Trash2 } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

type GroupSummary = {
    groupID: string;
    groupName: string;
}

type PhotoSummary = {
    photoId: string;
    uploaderID: string;
    image: string;
}

export default function GroupPhotosPanel({ activeGroup, userId, isLeader }: { activeGroup: GroupSummary | null, userId: string, isLeader: boolean }) {
    const [photos, setPhotos] = useState<PhotoSummary[]>([])
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length || !activeGroup?.groupID) return;

        for (const f of files) {
            if (f.size > 10 * 1024 * 1024) {
                alert(`${f.name} too large. Max 10MB`);
                return;
            }
        }

        const images = await Promise.all(
            files.map((f) => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();

                reader.onloadend = () => {
                    if (typeof reader.result === "string") {
                        resolve(reader.result);
                    } else {
                        reject(new Error(`Failed to read ${f.name}`));
                    }
                }

                reader.onerror = () => {
                    reject(new Error(`Failed to read ${f.name}`));
                }

                reader.readAsDataURL(f);
            }))
        )

        const res = await fetch(`/api/groups/${activeGroup?.groupID}/photos`, {
            method: "POST",
            body: JSON.stringify({ images })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || "Upload Failed");
        }

        setPhotos((prev) => [...data.images, ...prev]);
    }

    useEffect(() => {
        const fetchPhotos = async () => {
            if (!activeGroup?.groupID) return;

            setLoadingPhotos(true);
            try {
                const res = await fetch(`/api/groups/${activeGroup.groupID}/photos`);
                const data = await res.json();

                if (!res.ok) return;

                setPhotos(data.images ?? []);
            } catch (error) {

            } finally {
                setLoadingPhotos(false);
            }
        }

        fetchPhotos();
    }, [activeGroup?.groupID]);

    const handleDelete = async (imageId: string) => {
        if (!activeGroup?.groupID) return;

        try {
            const res = await fetch(`/api/groups/${activeGroup.groupID}/photos`, {
                method: "DELETE",
                body: JSON.stringify({ imageId: imageId })
            });

            if (!res.ok) {
                return;
            }

            setPhotos((prev) => prev.filter((photo) => photo.photoId !== imageId));
        } catch (e) {

        }
    }

    return (
        <div className="flex flex-col min-w-0 min-h-0 h-full">
            <div className="p-5 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold">
                            {activeGroup?.groupName?.[0].toUpperCase() ?? "G"}
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-semibold text-gray-900 truncate">
                                Photos
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()} 
                        className="flex bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-2 px-4 rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95"
                    >
                        <Plus size={20} />
                        Upload Photo(s)
                    </button>
                    <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/*"
                            multiple
                            className="hidden"
                        />
                </div>
            </div>

            {/* Images */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-white">
                {loadingPhotos ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        Loading Photos...
                    </div>
                ) : activeGroup && photos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Placeholder messages */}
                        {photos.map((p, i) => (
                            <div key={`${p.uploaderID}-${i}`} className="rouded-2x1 overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
                                <img
                                    src={p.image}
                                    alt={`Group photo ${i + 1}`}
                                    className="w-full h-56 object-cover"
                                />
                                <div className="flex justify-between">
                                    <div className="px-3 py-2 text-xs text-gray-500">
                                        Uploaded by {p.uploaderID === userId ? "you" : "a group member"}
                                    </div>
                                    { (userId === p.uploaderID || isLeader) &&
                                        <div className="px-3 py-2 text-xs text-gray-500">
                                            <button onClick={() => handleDelete(p.photoId)}>
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-center text-gray-500">
                        <div>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                <Image size={28} />
                            </div>
                            <p className="font-medium text-gray-700 mb-1">
                                No photos yet
                            </p>
                            <p className="text-sm text-gray-500">
                                Be the first to share the moment!
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}