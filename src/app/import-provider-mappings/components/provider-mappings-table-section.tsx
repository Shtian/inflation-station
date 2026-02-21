import { Ellipsis, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProviderMapping } from "../provider-mappings-manager.types";

export function ProviderMappingsTableSection(props: {
  loading: boolean;
  mappings: ProviderMapping[];
  busyKey: string | null;
  onEdit(mapping: ProviderMapping): void;
  onDelete(mappingId: string): void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-foreground text-sm uppercase tracking-wide">
        Existing mappings
      </h2>
      {props.loading ? (
        <p className="text-muted-foreground text-sm">Loading mappings...</p>
      ) : props.mappings.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No provider mappings configured yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Field mappings</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.mappings.map((mapping) => {
                const isDeleting = props.busyKey === `delete-${mapping.id}`;

                return (
                  <TableRow key={mapping.id}>
                    <TableCell>{mapping.providerName}</TableCell>
                    <TableCell>
                      {mapping.mappingVersion ? (
                        mapping.mappingVersion
                      ) : (
                        <span className="text-muted-foreground">Unset</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {mapping.fieldMappings.length}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Actions for ${mapping.providerName}`}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Ellipsis
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={() => props.onEdit(mapping)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => props.onDelete(mapping.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
