import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { uploadFiles } from '@/services/upload';
import { PortalLayout } from '../components/PortalLayout';
import {
  ConversationList,
  EmptyThread,
  MessageThread,
  NewConversationDialog,
  useConversation,
  useConversationSocket,
  useConversations,
} from '../features/messages';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePortalShell } from '../hooks/usePortalShell';

/*
 * Messages — the customer's conversations with the team: a master list of
 * threads and the open thread's messages + composer. It is the portal's face of
 * the live-chat / support module (AGENTS.md, Live Chat).
 *
 * One tree, one route (/app/messages/:conversationId?), drives every viewport.
 * From tablet up both panes show side by side; on mobile only one shows at a
 * time — the list, or the thread once one is opened — so the open conversation
 * lives in the URL and deep-links. The whole screen fills the workspace height
 * and each pane scrolls on its own, keeping the search, header, and composer
 * pinned the way a messaging app should.
 *
 * Nothing is hardcoded: conversations and messages come from the backend, so the
 * screen renders skeletons until they arrive and empty states once they do with
 * nothing to show. Delivery is realtime over `services/socket.ts` (AGENTS.md,
 * Live Chat) — the customer's own message is drawn immediately and reconciled
 * when the server confirms it, and an agent's reply arrives without a refetch.
 */

function MessagesHeader({ onNewMessage }: { onNewMessage: () => void }) {
  return (
    <header className="hidden shrink-0 items-start justify-between gap-4 md:flex">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.6px]">
          <Link to="/app" className="text-primary hover:underline">
            Dashboard
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500">Messages</span>
        </p>
        <h1 className="text-[28px] font-semibold leading-9 text-text lg:text-[32px] lg:leading-10">
          Messages
        </h1>
        <p className="text-[13px] leading-5 text-gray-500 lg:text-[14px]">
          All your conversations with our team, in one place.
        </p>
      </div>

      <button
        type="button"
        onClick={onNewMessage}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-input bg-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover lg:h-12 lg:px-5 lg:text-[16px]"
      >
        <Plus className="size-4 shrink-0 lg:size-[18px]" strokeWidth={2} aria-hidden="true" />
        New message
      </button>
    </header>
  );
}

export function MessagesPage() {
  const { user, onLogout } = usePortalShell();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [composing, setComposing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const conversationsQuery = useConversations(debouncedSearch);
  const threadQuery = useConversation(conversationId ?? '');
  const chat = useConversationSocket(conversationId ?? '');

  const activeSummary = conversationId
    ? conversationsQuery.data?.find((item) => item.id === conversationId)
    : undefined;

  const backToList = () => navigate('/app/messages');

  /*
   * Files are uploaded to R2 before the message is sent, so what travels with it
   * is a set of object keys rather than bytes (services/upload.ts). The composer
   * is held while that happens — a second send racing the first would attach the
   * files to whichever message won.
   */
  const onSend = async ({ text, files }: { text: string; files: File[] }) => {
    if (!conversationId) return;

    if (files.length === 0) {
      chat.send({ body: text });
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadFiles(files, 'support-attachment');
      chat.send({ body: text, attachments: uploaded });
    } finally {
      setUploading(false);
    }
  };

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="h-full w-full p-4 md:p-6 lg:p-content">
        <div className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col gap-5">
          <MessagesHeader onNewMessage={() => setComposing(true)} />

          <div className="flex min-h-0 flex-1 gap-4 md:gap-5 lg:gap-6">
            <ConversationList
              conversations={conversationsQuery.data}
              isLoading={conversationsQuery.isLoading}
              isError={conversationsQuery.isError}
              onRetry={() => void conversationsQuery.refetch()}
              search={search}
              onSearchChange={setSearch}
              activeId={conversationId}
              className={conversationId ? 'hidden md:flex' : 'flex'}
            />

            {conversationId ? (
              <MessageThread
                // Remount per conversation so the scroll position and composer
                // draft reset on switch (and the auto-scroll-to-newest re-runs
                // even between two threads of equal message count).
                key={conversationId}
                thread={threadQuery.data}
                summary={activeSummary}
                // Loading is the query being in flight — not "no data". A stale
                // deep link (deleted or unreachable thread) resolves with no
                // data and must fall through to the thread's own empty state
                // rather than sitting on a skeleton forever.
                isLoading={threadQuery.isLoading}
                onBack={backToList}
                onSend={(payload) => void onSend(payload)}
                onTyping={chat.notifyTyping}
                agentTyping={chat.agentTyping}
                busy={uploading}
              />
            ) : (
              <EmptyThread className="hidden md:flex" />
            )}
          </div>

          {!conversationId ? (
            <button
              type="button"
              onClick={() => setComposing(true)}
              aria-label="New message"
              className="absolute bottom-5 right-5 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg-elevation transition-colors hover:bg-accent-hover md:hidden"
            >
              <Plus className="size-6" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <NewConversationDialog
        open={composing}
        onClose={() => setComposing(false)}
        onCreated={(id) => {
          setComposing(false);
          // Straight into the new thread — the customer just wrote the first
          // message, so the list is not where they want to land.
          navigate(`/app/messages/${id}`);
        }}
      />
    </PortalLayout>
  );
}
