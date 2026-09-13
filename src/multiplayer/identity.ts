export type RiderRole = "host" | "guest";
export const RIDER_COLORS = { host: "#68bdb0", guest: "#e48670" } as const;
export const riderRole = (local: RiderRole, rival = false): RiderRole => rival ? (local === "host" ? "guest" : "host") : local;
export const riderColor = (local: RiderRole, rival = false) => RIDER_COLORS[riderRole(local, rival)];
export const riderColorIndex = (local: RiderRole, rival = false) => riderRole(local, rival) === "host" ? -2 : -1;
