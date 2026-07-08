const REM_GLOSSARY = [
  {
    code: "CO",
    desc: "Contractual Obligation. Amount for which the provider is financially liable. The patient may not billed for this amount",
  },
  {
    code: "45",
    desc: "Charge exceeds fee scheduled/maximum allowable or contracted/legislated fee arrangement. Usage : This adjustment amount cannot equal the total service or claim charge amount; and must not duplicate provider adjustment amounts (payments and contractual reductions) that have resulted from prior payer(s) adjudication.",
  },
  {
    code: "MA01",
    desc: " Alert: If you do not agree with what we approved for these services, you may appeal our decision. To make sure that we are fair to you, we require another individual that did not process your initial claim to conduct the appeal. However, in order to be eligible for an appeal, you must write to us within 120 days of the date you received this notice, unless you have a good reason for being late.",
  },
  {
    code: "MA07",
    desc: "Alert: The claim information has also been forwarded to Medicaid for review. for review",
  },
  {
    code: "MA18",
    desc: "Alert: The claim information is also being forwarded to the patient's supplemental insurer. Send any questions regarding supplemental benefits to them.",
  },
  {
    code: "N782",
    desc: "Alert: Patient is a Medicaid/ Qualified Medicare Beneficiary.  Review your records for any wrongfully collected coinsurance.  This amount may be billed to a subsequent payer.",
  },
  {
    code: "MA27",
    desc: "Missing/incomplete/invalid entitlement number or name shown on the claim",
  },
];
const EOB_CODES = [
  {
    code: "0192",
    desc: "Prior Authorization (PA) is required for this service. An approved PA was not found matching the provider, member, and service information on the claim.",
  },
  { code: "0452", desc: "CALCULATED DETAIL MEDICARE ALLOWED AMOUNT IS ZERO" },
  { code: "1526", desc: "Services billed exceed PA amount." },
  {
    code: "3008",
    desc: "The prior authorization does not match the services billed on your claim or there are no remaining units available for the line item. Please correct services or submit a new prior authorization for the services billed.",
  },
  {
    code: "3008",
    desc: "The prior authorization does not match the services billed on your claim or there are no remaining units available for the line item. Please correct services or submit a new prior authorization for the services billed.",
  },
  { code: "5035", desc: "EXACT DUPLICATE OF A PREVIOUSLY PAID CLAIM/DETAIL" },
  {
    code: "5040",
    desc: "POSSIBLE DUPLICATE OF A PREVIOUSLY PAID CLAIM/DETAIL",
  },
  {
    code: "5094",
    desc: "NCCI PTP conflict, practitioner, outpatient, DME - modifiers bypass possible",
  },
  { code: "5691", desc: "18 UNITS ALLOWED PER CALENDAR YEAR" },
  {
    code: "9906",
    desc: "Pricing Adjustment - Medicare pricing cutbacks applied.",
  },
  {
    code: "9918",
    desc: "Pricing Adjustment - Maximum allowable fee pricing applied.",
  },
  {
    code: "5544",
    desc: "ONE UNIT ALLOWED PER NINETY ROLLING DAYS WITHOUT PRIOR APPROVAL",
  },
  {
    code: "2950",
    desc: "The client has Medicare. Charges must billed to Medicare before billing Medicaid. Complete the Medicare payment information fields on the claim and retain a copy of the explanation of benefits.",
  },
  {
    code: "0038",
    desc: "The member is enrolled in a Medicaid Managed Care Plan. The service requested is covered by the Medicaid Managed Care Plan.",
  },
  {
    code: "1379",
    desc: "The service are not covered for the client's benefit plan when billed on this claim type.",
  },
  {
    code: "2590",
    desc: "The client has Medicare. Charges must billed to Medicare before billing Medicaid. Complete the Medicare payment information fields on the claim and retain a copy of the explanation of benefits.",
  },
  { code: "1249", desc: "Client Covered by Private Insurance." },
  { code: "5541", desc: "EIGHT UNITS ALLOWED PER DAY" },
  {
    code: "0205",
    desc: "Detail Rendering Provider is no longer enrolled for the Date of Service",
  },
  {
    code: "0205",
    desc: "Detail Rendering Provider is no longer enrolled for the Date of Service",
  },
  {
    code: "1009",
    desc: "A billing provider contract could not be assigned to this claim. Please refer to the provider billing manuals for guidelines about correct billing information and that you are using the correct billing provider ID. Please make sure that the billing provider has been revalidated and that you are using the correct billing provider service location.",
  },
  {
    code: "3110",
    desc: "The rendering provider is not a group member. Verify the rendering provider number/group number.",
  },
  {
    code: "3006",
    desc: "Denied. Member Not Eligibile For All/partial Dates. Please Rebill Only Covered Dates.",
  },
  {
    code: "5683",
    desc: "50 UNITS ALLOWED PER CALENDAR YEAR WITHOUT PRIOR APPROVAL",
  },
  { code: "7270", desc: "Invalid modifier/Procedure Code Combination" },
  {
    code: "5569",
    desc: "TWO UNITS ALLOWED PER CALENDAR YEAR WITHOUT PRIOR APPROVAL",
  },
  {
    code: "5056",
    desc: "SAME PROCEDURE/DIFFERENT MODIFIER NOT ALLOWED SAME DAY",
  },
  { code: "5649", desc: "ONE UNIT ALLOWED PER DAY" },
  { code: "5690", desc: "26 UNITS ALLOWED PER CALENDAR YEAR" },
  { code: "5691", desc: "18 UNITS ALLOWED PER CALENDAR YEAR" },
  { code: "8008", desc: "Provider Initiated Adjusment" },
  {
    code: "1280",
    desc: "Rendering Provider is not certified to perform procedure billed.",
  },
  {
    code: "1690",
    desc: "Quantity indicated for this service exceeds the maximum quantity limit established by the National Correct Coding Initiative",
  },
  { code: "6511", desc: "ADD-ON CODE BILLED W/O PAID PRIMARY" },
  {
    code: "5036",
    desc: "POSSIBLE DUPLICATE OF A PREVIOUSLY PAID CLAIM/DETAIL",
  },
  { code: "3170", desc: "The first modifier code is invalid" },
  {
    code: "1508",
    desc: "Billing Provider cannot be an Individual Provider or Servicing Provider cannot be a Group Provider",
  },
  { code: "0841", desc: "The timely filing deadline was exceeded." },
];
const SERVICE_CODES = [
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
];

module.exports = {
  EOB_CODES,
  SERVICE_CODES,
  REM_GLOSSARY,
};
