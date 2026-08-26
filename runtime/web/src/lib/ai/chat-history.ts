// AI Chat History Persistence Hook
// Uses localStorage for client-side persistence

import { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types';

const STORAGE_KEY = 'xinnengyuan_chat_history';
const MAX_CONVERSATIONS = 10;
const MAX_MESSAGES_PER_CONVERSATION = 50;

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
}

export interface ChatHistoryState {
    conversations: Conversation[];
    activeConversationId: string | null;
}

function generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateTitle(messages: Message[]): string {
    // Use first user message as title, truncated
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
        const content = firstUserMessage.content;
        return content.length > 30 ? content.substring(0, 30) + '...' : content;
    }
    return '新对话';
}

export function useChatHistory() {
    const [state, setState] = useState<ChatHistoryState>({
        conversations: [],
        activeConversationId: null,
    });
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as ChatHistoryState;
                setState(parsed);
            }
        } catch (e) {
            console.error('Failed to load chat history:', e);
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage whenever state changes
    useEffect(() => {
        if (!isLoaded || typeof window === 'undefined') return;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save chat history:', e);
        }
    }, [state, isLoaded]);

    // Get active conversation messages
    const activeMessages = useCallback((): Message[] => {
        if (!state.activeConversationId) return [];
        const conv = state.conversations.find(c => c.id === state.activeConversationId);
        return conv?.messages || [];
    }, [state]);

    // Start a new conversation
    const startNewConversation = useCallback(() => {
        const newConv: Conversation = {
            id: generateId(),
            title: '新对话',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setState(prev => ({
            conversations: [newConv, ...prev.conversations].slice(0, MAX_CONVERSATIONS),
            activeConversationId: newConv.id,
        }));

        return newConv.id;
    }, []);

    // Add message to active conversation
    const addMessage = useCallback((message: Message) => {
        setState(prev => {
            let activeId = prev.activeConversationId;
            let conversations = [...prev.conversations];

            // If no active conversation, create one
            if (!activeId) {
                const newConv: Conversation = {
                    id: generateId(),
                    title: '新对话',
                    messages: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                conversations = [newConv, ...conversations];
                activeId = newConv.id;
            }

            // Update the active conversation
            conversations = conversations.map(conv => {
                if (conv.id === activeId) {
                    const newMessages = [...conv.messages, message].slice(-MAX_MESSAGES_PER_CONVERSATION);
                    return {
                        ...conv,
                        messages: newMessages,
                        title: generateTitle(newMessages),
                        updatedAt: new Date().toISOString(),
                    };
                }
                return conv;
            });

            return {
                conversations: conversations.slice(0, MAX_CONVERSATIONS),
                activeConversationId: activeId,
            };
        });
    }, []);

    // Update the last assistant message (for streaming)
    const updateLastAssistantMessage = useCallback((content: string) => {
        setState(prev => {
            if (!prev.activeConversationId) return prev;

            return {
                ...prev,
                conversations: prev.conversations.map(conv => {
                    if (conv.id === prev.activeConversationId) {
                        const messages = [...conv.messages];
                        const lastIndex = messages.length - 1;
                        if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
                            messages[lastIndex] = { ...messages[lastIndex], content };
                        }
                        return { ...conv, messages, updatedAt: new Date().toISOString() };
                    }
                    return conv;
                }),
            };
        });
    }, []);

    // Switch to a conversation
    const switchConversation = useCallback((conversationId: string) => {
        setState(prev => ({
            ...prev,
            activeConversationId: conversationId,
        }));
    }, []);

    // Delete a conversation
    const deleteConversation = useCallback((conversationId: string) => {
        setState(prev => {
            const remaining = prev.conversations.filter(c => c.id !== conversationId);
            return {
                conversations: remaining,
                activeConversationId: prev.activeConversationId === conversationId
                    ? (remaining[0]?.id || null)
                    : prev.activeConversationId,
            };
        });
    }, []);

    // Clear all history
    const clearHistory = useCallback(() => {
        setState({
            conversations: [],
            activeConversationId: null,
        });
    }, []);

    return {
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        activeMessages: activeMessages(),
        isLoaded,
        startNewConversation,
        addMessage,
        updateLastAssistantMessage,
        switchConversation,
        deleteConversation,
        clearHistory,
    };
}
