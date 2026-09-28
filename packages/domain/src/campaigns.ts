import type { Campaign, SourceRecord } from './types';

export type CampaignIneligibility =
  | 'inactive'
  | 'out_of_period'
  | 'authority_unverified'
  | 'agreement_unverified'
  | 'budget_exhausted'
  | 'promotion_not_allowed';

/**
 * PR枠に出せるか（UI12）。契約・権限確認・期間・有効予算・ソースの広告化許可がすべて揃う場合だけ。
 * 予算が1クリック分に満たない求人はPR枠から外す（自然掲載としては別途表示されうる）。
 */
export function campaignIneligibility(campaign: Campaign, source: Pick<SourceRecord, 'commercialPromotionAllowed'> | undefined, now: Date): CampaignIneligibility | null {
  if (campaign.status !== 'active') return 'inactive';
  const t = now.getTime();
  if (t < new Date(campaign.startsAt).getTime() || t > new Date(campaign.endsAt).getTime()) return 'out_of_period';
  if (!campaign.authorityVerified) return 'authority_unverified';
  if (!campaign.agreementVerified) return 'agreement_unverified';
  if (!Number.isInteger(campaign.cpcJpy) || campaign.cpcJpy <= 0 || campaign.budgetRemainingJpy < campaign.cpcJpy) return 'budget_exhausted';
  if (!source?.commercialPromotionAllowed) return 'promotion_not_allowed';
  return null;
}
