"use client";

import { MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAssistantThreadAction } from "@/app/actions/delete-assistant-thread";
import { renameAssistantThreadAction } from "@/app/actions/rename-assistant-thread";
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
  const [title, setTitle] = useState(thread.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await renameAssistantThreadAction({
        id: thread.id,
        title,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
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
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();

  function confirm() {
    startDeleting(async () => {
      const result = await deleteAssistantThreadAction({ id: thread.id });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
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

export function AssistantThreadList({
  threads,
  activeThreadId,
}: {
  threads: AssistantThreadListItem[];
  activeThreadId: string | null;
}) {
  const [edit, setEdit] = useState<ThreadEdit | null>(null);
  const close = () => setEdit(null);

  return (
    <nav
      aria-label="Samtaler"
      className="flex max-h-60 min-h-0 flex-col gap-2 lg:max-h-[calc(100dvh-14rem)]"
    >
      <Link
        href="/assistant"
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "justify-start",
        })}
      >
        <SquarePen aria-hidden />
        Ny samtale
      </Link>

      {threads.length === 0 ? (
        <p className="px-2 py-1 text-muted-foreground text-xs">
          Ingen lagrede samtaler ennå
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-0.5">
            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <li
                  key={thread.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-md pr-1 hover:bg-muted",
                    isActive && "bg-muted",
                  )}
                >
                  <Link
                    href={`/assistant?thread=${thread.id}`}
                    aria-current={isActive ? "page" : undefined}
                    className="flex min-w-0 flex-1 flex-col px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span
                      className={cn(
                        "truncate",
                        isActive ? "font-medium text-foreground" : "",
                      )}
                    >
                      {thread.title}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {thread.updatedAtLabel}
                    </span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Valg for ${thread.title}`}
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEdit({ kind: "rename", thread })}
                      >
                        <Pencil aria-hidden />
                        Gi nytt navn
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setEdit({ kind: "delete", thread })}
                      >
                        <Trash2 aria-hidden />
                        Slett
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

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
    </nav>
  );
}
