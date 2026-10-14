import { Separator } from "@/components/ui/separator";
import { AssistantChat } from "./assistant-chat";

export default function AssistantPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-10">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Spør
        </h1>
        <p className="text-muted-foreground text-sm">
          Still spørsmål om forbruket ditt. Svarene bygger på transaksjonene du
          har importert, og samtalen lagres ikke.
        </p>
      </div>
      <Separator className="my-6" />
      <AssistantChat />
    </main>
  );
}
