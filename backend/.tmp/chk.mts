import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const roles = await p.staffRole.findMany({ select: { key: true, permissions: true } });
console.log("roles:", roles.map((r) => r.key + ":" + r.permissions.length).join(", "));
const rows = await p.staffProfile.findMany({ select: { roleKey: true, permissions: true, permissionOverrides: true } });
console.log("profiles:", rows.length);
for (const r of rows) console.log(" ", r.roleKey, "| perms:", r.permissions.length, "| ov:", JSON.stringify(r.permissionOverrides));
await p.$disconnect();
