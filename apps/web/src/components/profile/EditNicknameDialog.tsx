'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { cn } from '@/lib/utils';

interface EditNicknameDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentName: string;
    onSave: (newName: string) => Promise<void>;
}

export function EditNicknameDialog({ isOpen, onClose, currentName, onSave }: EditNicknameDialogProps) {
    const [name, setName] = useState(currentName);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset name when dialog opens
    useEffect(() => {
        if (isOpen) {
            setName(currentName);
            setError(null);
        }
    }, [isOpen, currentName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('名前を入力してください');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            await onSave(name.trim());
            onClose();
        } catch (err) {
            setError('名前の変更に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-surface-900 p-6 text-left align-middle shadow-xl transition-all border border-surface-200 dark:border-surface-800">
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-medium leading-6 text-surface-900 dark:text-white mb-4"
                                >
                                    表示名の変更
                                </Dialog.Title>
                                <div className="mt-2">
                                    <p className="text-sm text-surface-500 mb-4 hidden">
                                        変更した名前は自分のLINE上でのみ表示され、相手に通知されることはありません。
                                    </p>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                                                placeholder="名前を入力"
                                                autoFocus
                                            />
                                            {error && (
                                                <p className="mt-1 text-sm text-error-500">{error}</p>
                                            )}
                                        </div>

                                        <div className="flex gap-3 justify-end mt-6">
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="px-4 py-2 rounded-lg text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                                                disabled={saving}
                                            >
                                                キャンセル
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={saving || !name.trim()}
                                            >
                                                {saving ? '保存中...' : '保存'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
