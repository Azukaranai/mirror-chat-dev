'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { useChatStore } from '@/lib/stores';

interface NotificationBadgeProps {
    count: number;
    type: 'messages' | 'friends';
    className?: string; // For positioning adjustment
}

export function NotificationBadge({ count, type, className }: NotificationBadgeProps) {
    const { markAllMessagesAsRead, fetchNotifications } = useChatStore();

    if (count <= 0) return null;

    const handleMarkAsRead = async () => {
        if (type === 'messages') {
            await markAllMessagesAsRead();
        }
    };

    const handleRefresh = async () => {
        await fetchNotifications();
    };

    // Mobile badge specific styling vs Desktop
    const badgeStyle = "flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error-500 px-1.5 text-xs font-bold text-white hover:bg-error-600 transition-colors cursor-pointer ring-2 ring-white dark:ring-surface-900 shadow-sm";

    return (
        <Menu as="div" className={`relative inline-block text-left ${className || ''}`}>
            <Menu.Button className="flex items-center justify-center outline-none" onClick={(e) => e.stopPropagation()}>
                <span className={badgeStyle}>
                    {count > 99 ? '99+' : count}
                </span>
            </Menu.Button>
            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className="absolute z-50 mt-2 w-48 origin-top-right rounded-xl bg-white dark:bg-surface-800 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-700 right-0 transform"
                    onClick={(e) => e.stopPropagation()} // Prevent parent link click
                >
                    <div className="py-1">
                        <div className="px-4 py-2 text-xs font-medium text-surface-500 uppercase tracking-wider border-b border-surface-100 dark:border-surface-700/50">
                            {type === 'messages' ? '未読メッセージ' : '友達リクエスト'}
                        </div>
                        {type === 'messages' && (
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={handleMarkAsRead}
                                        className={`${active ? 'bg-surface-50 dark:bg-surface-700/50' : ''
                                            } group flex w-full items-center px-4 py-2.5 text-sm text-surface-700 dark:text-surface-200 transition-colors`}
                                    >
                                        <svg className="mr-3 h-4 w-4 text-surface-400 group-hover:text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        すべて既読にする
                                    </button>
                                )}
                            </Menu.Item>
                        )}
                        <Menu.Item>
                            {({ active }) => (
                                <button
                                    onClick={handleRefresh}
                                    className={`${active ? 'bg-surface-50 dark:bg-surface-700/50' : ''
                                        } group flex w-full items-center px-4 py-2.5 text-sm text-surface-700 dark:text-surface-200 transition-colors`}
                                >
                                    <svg className="mr-3 h-4 w-4 text-surface-400 group-hover:text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                    </svg>
                                    通知を更新
                                </button>
                            )}
                        </Menu.Item>
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
}
