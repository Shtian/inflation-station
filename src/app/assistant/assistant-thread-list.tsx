"use client";

import { useRouter as useStartRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ASSISTANT_THREAD_TITLE_MAX_LENGTH } from "@/lib/assistant/threads";
import { cn } from "@/lib/utils";
import {
  deleteAssistantThreadFn,
  renameAssistantThreadFn,
} from "@/routes/assistant/-server";

export type AssistantThreadListItem = {
  id: string;
  title: string;
  updatedAtLabel: string;
};

type ThreadEdit =
  | { kind: "rename"; thread: AssistantThreadListItem }
  | { kind: "delete"; thread: AssistantThreadListItem };

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
    >
      {message}
    </p>
  );
}

function RenameThreadDialog({
  thread,
  onClose,
}: {
  thread: AssistantThreadListItem;
  onClose: () => void;
}) {
  const startRouter = useStartRouter();
  const renameAssistantThread = useServerFn(renameAssistantThreadFn);
  const [title, setTitle] = useState(thread.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await renameAssistantThread({
        data: { id: thread.id, title },
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await startRouter.invalidate();
      toast.success("Samtalen fikk nytt navn");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gi nytt navn</DialogTitle>
          <DialogDescription>
            Navnet vises i listen over samtaler.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Field>
            <FieldLabel htmlFor="assistant-thread-title">Navn</FieldLabel>
            <FieldContent>
              <Input
                id="assistant-thread-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={ASSISTANT_THREAD_TITLE_MAX_LENGTH}
                disabled={saving}
                autoFocus
              />
            </FieldContent>
          </Field>
          <ErrorMessage message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? "Lagrer…" : "Lagre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteThreadDialog({
  thread,
  isActive,
  onClose,
}: {
  thread: AssistantThreadListItem;
  isActive: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const startRouter = useStartRouter();
  const deleteAssistantThread = useServerFn(deleteAssistantThreadFn);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();

  function confirm() {
    startDeleting(async () => {
      const result = await deleteAssistantThread({ data: { id: thread.id } });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await startRouter.invalidate();
      toast.success("Samtalen ble slettet");
      onClose();
      if (isActive) {
        router.push("/assistant");
      }
    });
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !deleting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Slette samtalen?</AlertDialogTitle>
          <AlertDialogDescription>
            «{thread.title}» slettes permanent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ErrorMessage message={error} />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={deleting}>
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={confirm}
            disabled={deleting}
          >
            {deleting ? "Sletter…" : "Slett"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function useThreadEdits(activeThreadId: string | null) {
  const [edit, setEdit] = useState<ThreadEdit | null>(null);
  const close = () => setEdit(null);

  const dialogs = (
    <>
      {edit?.kind === "rename" ? (
        <RenameThreadDialog
          key={edit.thread.id}
          thread={edit.thread}
          onClose={close}
        />
      ) : null}
      {edit?.kind === "delete" ? (
        <DeleteThreadDialog
          key={edit.thread.id}
          thread={edit.thread}
          isActive={edit.thread.id === activeThreadId}
          onClose={close}
        />
      ) : null}
    </>
  );

  return { setEdit, dialogs };
}

function ThreadActionsMenu({
  thread,
  label,
  onEdit,
  className,
}: {
  thread: AssistantThreadListItem;
  label: string;
  onEdit: (edit: ThreadEdit) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className={className}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit({ kind: "rename", thread })}>
          <Pencil aria-hidden />
          Gi nytt navn
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onEdit({ kind: "delete", thread })}
        >
          <Trash2 aria-hidden />
          Slett
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NewThreadLink() {
  return (
    <Link
      href="/assistant"
      aria-label="Ny samtale"
      title="Ny samtale"
      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
    >
      <SquarePen aria-hidden />
    </Link>
  );
}

export function AssistantThreadList({
  threads,
  activeThreadId,
}: {
  threads: AssistantThreadListItem[];
  activeThreadId: string | null;
}) {
  const { setEdit, dialogs } = useThreadEdits(activeThreadId);

  return (
    <nav aria-label="Samtaler" className="flex min-h-0 flex-1 flex-col">
      {threads.length === 0 ? (
        <p className="px-4 text-muted-foreground text-xs">
          Ingen lagrede samtaler ennå
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-px px-2 pb-6">
            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <li
                  key={thread.id}
                  className={cn(
                    "group relative flex items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                    isActive && "bg-muted text-foreground hover:bg-muted",
                  )}
                >
                  <Link
                    href={`/assistant?thread=${thread.id}`}
                    aria-current={isActive ? "page" : undefined}
                    className="flex min-w-0 flex-1 items-baseline gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {thread.title}
                    </span>
                    <span className="shrink-0 text-muted-foreground text-xs tabular-nums group-focus-within:opacity-0 group-hover:opacity-0">
                      {thread.updatedAtLabel}
                    </span>
                  </Link>
                  <ThreadActionsMenu
                    thread={thread}
                    label={`Valg for ${thread.title}`}
                    onEdit={setEdit}
                    className="absolute right-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100"
                  />
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
      {dialogs}
    </nav>
  );
}

export function AssistantThreadHeader({
  thread,
}: {
  thread: AssistantThreadListItem | null;
}) {
  const { setEdit, dialogs } = useThreadEdits(thread?.id ?? null);

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 px-6">
      <h2
        className={cn(
          "min-w-0 flex-1 truncate font-medium text-sm",
          !thread && "text-muted-foreground",
        )}
      >
        {thread?.title ?? "Ny samtale"}
      </h2>
      {thread ? (
        <ThreadActionsMenu
          thread={thread}
          label="Valg for samtalen"
          onEdit={setEdit}
        />
      ) : null}
      {dialogs}
    </header>
  );
}
