import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBooking, type CreateBookingInput } from "@/lib/booking/repository";

const db = vi.hoisted(() => ({ insert: vi.fn(), result: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  from: () => ({ insert: db.insert }),
}) }));

const input: CreateBookingInput = {
  eventType: {
    id: "appointment", userId: "owner", slug: "rendez-vous", name: "Rendez-vous",
    durationMin: 30, bufferMin: 0, minNoticeMin: 0, horizonDays: 30,
    slotStepMin: 15, timezone: "Europe/Paris", locationKind: "visio", language: "fr", active: true,
  },
  startsAt: "2026-09-04T09:15:00Z", endsAt: "2026-09-04T09:45:00Z",
  visitorTimezone: "Europe/Paris", visitorName: "Test", visitorEmail: "test@example.com",
  sessionId: null,
};
const success = { data: { id: "booking", manage_token: "token" }, error: null };
const missing = (column: string) => ({ data: null, error: {
  code: "PGRST204", message: `Could not find the '${column}' column of 'bookings' in the schema cache`,
} });

beforeEach(() => {
  vi.clearAllMocks();
  db.result.mockReset();
  db.insert.mockImplementation(() => ({ select: () => ({ maybeSingle: db.result }) }));
});

describe("réservation compatible avec le schéma de production", () => {
  it("omet session_id et answers vides pour une consultation individuelle", async () => {
    db.result.mockResolvedValueOnce(success);
    expect(await createBooking({ ...input, answers: {} })).toEqual({ ok: true, id: "booking", manageToken: "token" });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert.mock.calls[0][0]).not.toHaveProperty("session_id");
    expect(db.insert.mock.calls[0][0]).not.toHaveProperty("answers");
  });

  it("préserve les réponses dans note si seule la colonne answers manque", async () => {
    db.result.mockResolvedValueOnce(missing("answers")).mockResolvedValueOnce(success);
    expect((await createBooking({ ...input, note: "Objectif", answers: { niveau: "Débutant", accord: true } })).ok).toBe(true);
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db.insert.mock.calls[1][0]).toMatchObject({ note: "Objectif\n\nniveau: Débutant\naccord: true" });
    expect(db.insert.mock.calls[1][0]).not.toHaveProperty("answers");
  });

  it("ne supprime jamais une vraie session pour contourner une erreur de schéma", async () => {
    db.result.mockResolvedValueOnce(missing("session_id"));
    const result = await createBooking({ ...input, sessionId: "session", answers: { niveau: "A" } });
    expect(result).toMatchObject({ ok: false, reason: "db_error" });
    expect(JSON.stringify(result)).not.toMatch(/session_id|schema|bookings/);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert.mock.calls[0][0].session_id).toBe("session");
  });

  it("ne réessaie pas une erreur inconnue et ne divulgue pas le détail technique", async () => {
    db.result.mockResolvedValueOnce(missing("private_column"));
    const result = await createBooking({ ...input, answers: { niveau: "A" } });
    expect(result).toMatchObject({ ok: false, reason: "db_error" });
    expect(JSON.stringify(result)).not.toContain("private_column");
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("garde la protection du créneau déjà réservé", async () => {
    db.result.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "private index" } });
    expect(await createBooking(input)).toMatchObject({ ok: false, reason: "slot_taken" });
  });

  it("traduit une exception réseau en erreur publique générique", async () => {
    db.result.mockRejectedValueOnce(new Error("private infrastructure"));
    const result = await createBooking(input);
    expect(result).toMatchObject({ ok: false, reason: "db_error" });
    expect(JSON.stringify(result)).not.toContain("private infrastructure");
  });
});
