export interface ClaimItem {
  memberName?: string
  service?: string
  modifierCd?: string
  srvDateFrom?: string
  srvDateTo?: string
  billedAmt?: number
  allowedAmt?: number
  deductible?: number
  coinsurance?: number
  paidAmt?: number
  eobCd?: string
  remCd?: string
  claimNum?: string
  icn?: string
  dos?: string
  procDesc?: string
}

export interface AdjustmentItem {
  memberName?: string
  procCd?: string
  modifier?: string
  procDesc?: string
  from?: string
  to?: string
  billAmount?: number
  paidAmount?: number
  detail?: string
  detailDescription?: string
}

export interface ServiceSummary {
  name: string
  medicarePaid: number
  medicaidPaid: number
  medicareDenied: number
  medicaidDenied: number
  desc: string
  total: number
}

export interface RemittanceSummary {
  remittanceDate?: string
  remittanceEftNumber?: string
  remittanceEftDate?: string
  claimsCurrentNumber?: string
  claimsCurrentAmount?: string
  claimsAdjustmentsNumber?: string
  claimAdjustmentsAmount?: string
  totalClaimsPaymentNumber?: string
  totalClaimsPaymentAmount?: string
  totalClaimsDeniedNumber?: string
  totalClaimsDeniedAmount?: string | number
  totalClaimsPaymentsAmount?: string
  totalClaimsAdjPaymentsAmount?: string
  totalClaimAdjFromCurrentCyclePaymentAmount?: string
  totalClaimAdjFromPreviousCyclePaymentAmount?: string
  netEarningsAmount?: string
  filename?: string
}

export interface ParsedClaimData {
  medicaid: {
    paid: ClaimItem[]
    denied: ClaimItem[]
  }
  medicare: {
    paid: ClaimItem[]
    denied: ClaimItem[]
  }
  medicaidSummary: {
    paid: { count: number; amount: string }
    denied: { count: number; amount: string }
  }
  medicareSummary: {
    paid: { count: number; amount: string }
    denied: { count: number; amount: string }
  }
  adjustments: AdjustmentItem[]
  services: ServiceSummary[]
  remittance: RemittanceSummary
  netPayment: number
  deniedAmount: number
  totalNumber: {
    payments: number
    denied: number
    adjustment: number
  }
}
