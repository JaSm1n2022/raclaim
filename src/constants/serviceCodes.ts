export const SERVICE_CODES = [
  { code: "90837", desc: "PSYTX W PT 60 MINUTES" },
  { code: "90853", desc: "GROUP PSYCHOTHERAPY" },
  { code: "90876", desc: "PSYCHOPHYSIOLOGICAL THERAPY" },
  { code: "H0002", desc: "ALCOHOL AND/OR DRUG SCREENIN" },
  { code: "H0004", desc: "ALCOHOL AND/OR DRUG SERVICES" },
  { code: "H2014", desc: "SKILLS TRAIN AND DEV 15 MIN" },
  { code: "H2017", desc: "PSYSOC REHAB SVC, PER 15 MIN" },
  { code: "H0031", desc: "MH HEALTH ASSESS BY NON-MD" },
  { code: "90791", desc: "PSYCH DIAGNOSTIC EVALUATION" },
  { code: "90839", desc: "PSYTX CRISIS INITIAL 60 MIN" },
] as const

export type ServiceCode = typeof SERVICE_CODES[number]['code']

export const SERVICE_CODE_MAP: Record<string, string> = SERVICE_CODES.reduce(
  (acc, { code, desc }) => ({ ...acc, [code]: desc }),
  {}
)
