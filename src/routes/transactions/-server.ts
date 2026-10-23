import { createServerFn } from "@tanstack/react-start";
import { prisma } from "@/lib/prisma";
import { listTripOptions } from "@/lib/trips/load";

export const getTripOptions = createServerFn({ method: "GET" }).handler(() =>
  listTripOptions(prisma),
);
