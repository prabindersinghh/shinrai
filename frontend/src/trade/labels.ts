/** Bilingual labels for trade states, documents and glossary terms. Pairs are [en, ja]. */
import type { DocKind, MemberState, PayState, PoolState, PoState, VerificationCheck } from "./types";

type Pair = [string, string];
type Tone = "ink" | "green" | "amber" | "red" | "muted" | "blue";

export const POOL_STATE: Record<PoolState, { l: Pair; tone: Tone; d: Pair }> = {
  DRAFT: { l: ["Draft", "下書き"], tone: "muted", d: ["Not yet visible to other buyers.", "他社にはまだ表示されません。"] },
  OPEN: { l: ["Open", "受付中"], tone: "blue", d: ["Buyers are committing quantities until the deadline.", "締切まで各社が数量を確約しています。"] },
  QUOTE_PENDING: { l: ["Awaiting quote", "見積待ち"], tone: "amber", d: ["Threshold reached. The supplier prices the combined volume.", "目標数量に到達。サプライヤーが合計数量で見積中です。"] },
  QUOTED: { l: ["Quoted", "見積済"], tone: "blue", d: ["A versioned quote has been issued.", "版管理された見積が発行されました。"] },
  CONFIRMATION: { l: ["Confirmation", "承諾受付"], tone: "amber", d: ["Each buyer accepts the exact quote version before its own PO is created.", "各社が見積版を承諾すると、個別の発注書が作成されます。"] },
  REQUOTE: { l: ["Requote", "再見積"], tone: "amber", d: ["Accepted volume fell below the tier; the supplier may requote.", "承諾数量が単価帯を下回り、再見積の可能性があります。"] },
  CONFIRMED: { l: ["Confirmed", "確定"], tone: "green", d: ["Volume confirmed at the quoted tier.", "見積単価帯で数量が確定しました。"] },
  CLOSED: { l: ["Closed · POs issued", "締切・発注済"], tone: "green", d: ["Every accepted buyer now has its own purchase order.", "承諾した各社に個別の発注書が発行されました。"] },
  FAILED_THRESHOLD: { l: ["Threshold not met", "目標未達"], tone: "red", d: ["The pool closed below the minimum. Nobody is charged or bound.", "目標数量に届かず終了。誰にも費用・義務は発生しません。"] },
  SUPPLIER_DECLINED: { l: ["Supplier declined", "サプライヤー辞退"], tone: "red", d: ["The supplier did not quote. No obligations.", "見積が提示されませんでした。義務はありません。"] },
  CANCELLED: { l: ["Cancelled", "中止"], tone: "muted", d: ["Cancelled by the organiser. No obligations.", "主催者が中止。義務はありません。"] },
};

export const MEMBER_STATE: Record<MemberState, { l: Pair; tone: Tone }> = {
  INTERESTED: { l: ["Interested (non-binding)", "関心のみ（拘束なし）"], tone: "muted" },
  COMMITTED: { l: ["Committed (conditional)", "確約（条件付き）"], tone: "blue" },
  ACCEPTED: { l: ["Accepted quote", "見積承諾済"], tone: "green" },
  ORDERED: { l: ["Purchase order issued", "発注書発行済"], tone: "green" },
  WITHDRAWN: { l: ["Withdrawn", "辞退"], tone: "muted" },
  RELEASED: { l: ["Released", "解除"], tone: "amber" },
  LAPSED: { l: ["Lapsed", "失効"], tone: "muted" },
};

export const PO_STATE: Record<PoState, { l: Pair; tone: Tone; next: Pair }> = {
  ISSUED: { l: ["Issued", "発行済"], tone: "blue", next: ["Supplier confirms the order", "サプライヤーが受注確認"] },
  SUPPLIER_ACCEPTED: { l: ["Supplier accepted", "受注確認済"], tone: "blue", next: ["Payment terms apply", "支払条件に移行"] },
  AWAITING_ADVANCE: { l: ["Awaiting advance", "前払待ち"], tone: "amber", next: ["Buyer pays the advance", "買い手が前払"] },
  IN_PRODUCTION: { l: ["In production", "生産中"], tone: "blue", next: ["Supplier uploads invoice + packing list", "サプライヤーが請求書・梱包明細を登録"] },
  READY_TO_SHIP: { l: ["Ready to ship", "出荷準備完了"], tone: "blue", next: ["Supplier uploads the bill of lading", "サプライヤーがB/Lを登録"] },
  SHIPPED: { l: ["Shipped", "出荷済"], tone: "blue", next: ["Buyer confirms delivery", "買い手が受領確認"] },
  DELIVERED: { l: ["Delivered", "受領済"], tone: "green", next: ["Buyer pays balance, then completes", "残金支払後に完了"] },
  COMPLETED: { l: ["Completed", "完了"], tone: "green", next: ["Reorder any time", "いつでも再発注可能"] },
  DISPUTED: { l: ["Disputed", "紛争中"], tone: "red", next: ["Parties resolve under the PO terms", "発注条件に基づき当事者間で解決"] },
  CANCELLED: { l: ["Cancelled", "取消"], tone: "muted", next: ["No further action", "対応不要"] },
};
export const PO_FLOW_ORDER: PoState[] = ["ISSUED", "AWAITING_ADVANCE", "IN_PRODUCTION", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED"];

export const PAY_STATE: Record<PayState, { l: Pair; tone: Tone }> = {
  UNQUOTED: { l: ["Not quoted", "未見積"], tone: "muted" },
  QUOTED: { l: ["Quoted", "見積済"], tone: "blue" },
  EXPIRED: { l: ["Quote expired", "見積期限切れ"], tone: "amber" },
  INITIATED: { l: ["Instruction sent", "送金指示済"], tone: "blue" },
  PENDING: { l: ["Pending at provider", "処理中"], tone: "amber" },
  SETTLED: { l: ["Settled", "着金"], tone: "green" },
  FAILED: { l: ["Failed", "失敗"], tone: "red" },
  REFUND_PENDING: { l: ["Refund pending", "返金処理中"], tone: "amber" },
  REFUNDED: { l: ["Refunded", "返金済"], tone: "muted" },
  REVERSED: { l: ["Reversed", "取消（組戻し）"], tone: "red" },
  DISPUTED: { l: ["Disputed", "異議申立中"], tone: "red" },
};

export const DOC: Record<DocKind, Pair> = {
  commercial_invoice: ["Commercial invoice", "商業送り状（インボイス）"],
  packing_list: ["Packing list", "梱包明細書"],
  bill_of_lading: ["Bill of lading", "船荷証券（B/L）"],
  certificate_of_origin: ["Certificate of origin (CEPA)", "原産地証明書（CEPA）"],
  inspection_report: ["Inspection report", "検査報告書"],
};

export const CHECK: Record<VerificationCheck["id"], Pair> = {
  registry: ["Company registry (MCA)", "法人登記（MCA）"], gst: ["GST registration", "GST登録"], iec: ["Importer-Exporter Code", "輸出入者コード（IEC）"],
  network: ["Director network", "取締役ネットワーク"], legal: ["Courts & insolvency", "訴訟・倒産"], claims: ["Brochure claims", "会社資料の主張"],
  ground: ["Site from satellite", "衛星による拠点確認"], audit: ["Genba audit", "現地監査"], cert: ["Certification register", "認証登録"],
};

export const TONE: Record<Tone, string> = {
  ink: "bg-ink text-white", green: "bg-verified-soft text-verified", amber: "bg-amber-soft text-amber", red: "bg-hinomaru-soft text-hinomaru-deep",
  muted: "bg-stage text-ink-3 ring-1 ring-line", blue: "bg-[#EAF0F8] text-[#1E3A5F]",
};

export const GLOSSARY: Record<string, { t: Pair; d: Pair }> = {
  moq: { t: ["MOQ", "最低発注数量"], d: ["Minimum order quantity: the smallest order the supplier accepts. Pooling lets several buyers reach it together.", "サプライヤーが受け付ける最小の発注数量。共同発注なら複数社で到達できます。"] },
  incoterm: { t: ["Incoterm", "インコタームズ"], d: ["Who pays and carries risk for each leg. FOB: the supplier delivers on board at the Indian port; you arrange sea freight, insurance and import.", "費用と危険の分担。FOB：サプライヤーがインド港で本船に積込み、海上運賃・保険・輸入は買い手が手配します。"] },
  hs: { t: ["HS code", "HSコード"], d: ["The tariff classification. Shown here as a proposal only; a licensed customs broker (通関業者) or an advance ruling confirms it.", "関税分類。ここでは提案のみ。通関業者または事前教示で確定します。"] },
  fx: { t: ["FX quote", "為替見積"], d: ["A rate with a timestamp and expiry. After it expires you request a new one. In this prototype the rate is SIMULATED.", "時刻と有効期限付きのレート。期限後は再見積。本試作ではシミュレーションです。"] },
  tier: { t: ["Price tier", "数量単価帯"], d: ["The supplier's unit price falls as the total quantity rises. Everyone in a pool pays the same tier price on their own PO.", "合計数量が増えると単価が下がります。参加各社は自社の発注書で同じ単価になります。"] },
  ceiling: { t: ["Maximum unit price", "上限単価"], d: ["Private to you. If the final price is above it, you are released automatically — no obligation.", "自社のみに表示。最終単価が上回れば自動的に解除され、義務は生じません。"] },
  ior: { t: ["Importer of record", "輸入者"], d: ["Each buyer imports its own goods under its own declaration. Shinrai is a facilitator, never the buyer or seller.", "各社が自社名義で輸入申告します。信頼は仲介のみで、売買の当事者ではありません。"] },
  ctax: { t: ["Import consumption tax", "輸入消費税"], d: ["10% on (CIF + duty), paid at import and normally creditable for taxable businesses. Never counted as a saving.", "（CIF＋関税）の10%。輸入時に納付し、通常は仕入税額控除の対象。削減額には含めません。"] },
  cepa: { t: ["Japan–India CEPA", "日インドCEPA"], d: ["Preferential duty needs a certificate of origin per importation and direct shipment. For most machinery parts Japan's duty is already 0%.", "特恵税率には輸入ごとの原産地証明書と直送が必要。機械部品の多くは既に関税0%です。"] },
};
