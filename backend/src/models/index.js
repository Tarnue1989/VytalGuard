import { Sequelize } from "sequelize";

// 📦 Core Models
import OrganizationModel from "./Organization.js";
import FacilityModel from "./Facility.js";
import UserModel from "./User.js";
import RoleModel from "./Role.js";
import UserFacilityModel from "./UserFacility.js";
import DepartmentModel from "./Department.js";
import EmployeeModel from "./Employee.js";
import RefreshTokenModel from "./RefreshToken.js";
import PasswordHistoryModel from "./PasswordHistory.js";

// 📦 Feature Modules
import FeatureAccessModel from "./FeatureAccess.js";
import FeatureModuleModel from "./FeatureModule.js";

// 📦 Billing & Finance
import InvoiceModel from "./Invoice.js";
import InvoiceItemModel from "./InvoiceItem.js";
import PaymentModel from "./Payment.js";
import RefundModel from "./Refund.js";
import DepositModel from "./Deposit.js";
import BillableItemModel from "./BillableItem.js";
import BillableItemPriceHistoryModel from "./BillableItemPriceHistory.js";
import AutoBillingRuleModel from "./AutoBillingRule.js";
import BillingTriggerModel from "./BillingTrigger.js";
import DiscountWaiverModel from "./DiscountWaiver.js";
import DiscountPolicyModel from "./DiscountPolicy.js";
import TaxPolicyModel from "./TaxPolicy.js";
import CurrencyRateModel from "./CurrencyRate.js";
import InsuranceProviderModel from "./InsuranceProvider.js";
import InsuranceClaimModel from "./InsuranceClaim.js";
import InsurancePreAuthorizationModel from "./InsurancePreAuthorization.js";
import InvoiceLineExtensionModel from "./InvoiceLineExtension.js";
import DiscountModel from "./Discount.js"; 
import TaxModel from "./Tax.js";
import FinancialLedgerModel from "./FinancialLedger.js";
import DepositApplicationModel from "./DepositApplication.js";
import RefundTransactionModel from "./RefundTransaction.js";
import RefundDepositTransactionModel from "./RefundDepositTransaction.js";   // ✅ NEW
import RefundDepositModel from "./RefundDeposit.js";


// 📦 Inventory & Master Data
import MasterItemModel from "./MasterItem.js";
import MasterItemCategoryModel from "./MasterItemCategory.js";
import CentralStockModel from "./CentralStock.js";
import DepartmentStockModel from "./DepartmentStock.js";   // ✅ added
import StockRequestModel from "./StockRequest.js";
import StockRequestItemModel from "./StockRequestItem.js";
import SupplierModel from "./Supplier.js";
import StockLedgerModel from "./StockLedger.js";
import StockAdjustmentModel from "./StockAdjustment.js";
import StockReturnModel from "./StockReturn.js";
import StockIssueModel from "./StockIssue.js";   // ✅ new


// 📦 Clinical & Patient Flow
import PatientModel from "./Patient.js";
import RegistrationLogModel from "./RegistrationLog.js";
import ConsultationModel from "./Consultation.js";
import ConsultationStaffModel from "./ConsultationStaff.js";
import MedicalRecordModel from "./MedicalRecord.js";
import TriageRecordModel from "./TriageRecord.js";
import VitalModel from "./Vital.js";
import AdmissionModel from "./Admission.js";
import AppointmentModel from "./Appointment.js";
import RadiologyRecordModel from "./RadiologyRecord.js";
import UltrasoundRecordModel from "./UltrasoundRecord.js";
import DeliveryRecordModel from "./DeliveryRecord.js";
import MaternityVisitModel from "./MaternityVisit.js";
import NewbornRecordModel from "./NewbornRecord.js";
import MessageModel from "./Message.js";
import MessageAttachmentModel from "./MessageAttachment.js";
import RecommendationModel from "./Recommendation.js";
import PrescriptionModel from "./Prescription.js";
import PrescriptionItemModel from "./PrescriptionItem.js";
import PharmacyTransactionModel from "./PharmacyTransaction.js";
import PatientEmployeeLinkModel from "./PatientEmployeeLink.js";
import LabRequestModel from "./LabRequest.js";
import LabResultModel from "./LabResult.js";
import LabRequestItemModel from "./LabRequestItem.js";
import EKGRecordModel from "./EKGRecord.js";
import SurgeryModel from "./Surgery.js";
// 📦 Patient Chart & Records (Enterprise Extension)
import PatientChartNoteModel from "./patientChartNote.js";
import PatientChartViewLogModel from "./patientChartViewLog.js";
import PatientChartCacheModel from "./patientChartCache.js";

// 📦 Bed / Ward / Room
import BedModel from "./Bed.js";
import WardModel from "./Ward.js";
import RoomModel from "./Room.js";

// 📦 System / Logs
import AccessViolationLogModel from "./AccessViolationLog.js";
import ConversationModel from "./Conversation.js";
import SystemAuditLogModel from "./SystemAuditLog.js";

// 📦 RBAC
import PermissionModel from "./Permission.js";
import RolePermissionModel from "./RolePermission.js";


// 🛠 Create Sequelize instance
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("❌ DATABASE_URL is not defined");
}

const isLocal =
  databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1");

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  dialectOptions: isLocal
    ? {} // ❌ NO SSL for local Postgres
    : {
        ssl: {
          require: true,
          rejectUnauthorized: false, // ✅ required by Render
        },
      },
});

// 🏗 Initialize models
const models = {
  // 🔹 Core
  Organization: OrganizationModel(sequelize),
  Facility: FacilityModel(sequelize),
  User: UserModel(sequelize),
  Role: RoleModel(sequelize),
  UserFacility: UserFacilityModel(sequelize),
  Department: DepartmentModel(sequelize),
  Employee: EmployeeModel(sequelize),
  RefreshToken: RefreshTokenModel(sequelize),
  PasswordHistory: PasswordHistoryModel(sequelize),

    // 🔹 RBAC
  Permission: PermissionModel(sequelize),
  RolePermission: RolePermissionModel(sequelize),
  // 🔹 Feature
  FeatureAccess: FeatureAccessModel(sequelize),
  FeatureModule: FeatureModuleModel(sequelize),

  // 🔹 Billing
  Invoice: InvoiceModel(sequelize),
  InvoiceItem: InvoiceItemModel(sequelize),
  InvoiceLineExtension: InvoiceLineExtensionModel(sequelize),
  Payment: PaymentModel(sequelize),
  Refund: RefundModel(sequelize),
  Deposit: DepositModel(sequelize),
  DepositApplication: DepositApplicationModel(sequelize), 
  BillableItem: BillableItemModel(sequelize),
  BillableItemPriceHistory: BillableItemPriceHistoryModel(sequelize),
  AutoBillingRule: AutoBillingRuleModel(sequelize),
  BillingTrigger: BillingTriggerModel(sequelize),
  Discount: DiscountModel(sequelize),
  DiscountWaiver: DiscountWaiverModel(sequelize),
  DiscountPolicy: DiscountPolicyModel(sequelize),
  Tax: TaxModel(sequelize),
  TaxPolicy: TaxPolicyModel(sequelize),
  CurrencyRate: CurrencyRateModel(sequelize),
  InsuranceProvider: InsuranceProviderModel(sequelize),
  InsuranceClaim: InsuranceClaimModel(sequelize),
  InsurancePreAuthorization: InsurancePreAuthorizationModel(sequelize),
  FinancialLedger: FinancialLedgerModel(sequelize),
  RefundTransaction: RefundTransactionModel(sequelize),
  RefundDeposit: RefundDepositModel(sequelize),
  RefundDepositTransaction: RefundDepositTransactionModel(sequelize),

  // 🔹 Inventory
  MasterItem: MasterItemModel(sequelize),
  MasterItemCategory: MasterItemCategoryModel(sequelize),
  CentralStock: CentralStockModel(sequelize),
  DepartmentStock: DepartmentStockModel(sequelize),   // ✅ added
  StockRequest: StockRequestModel(sequelize),
  StockRequestItem: StockRequestItemModel(sequelize),
  Supplier: SupplierModel(sequelize),
  StockLedger: StockLedgerModel(sequelize),
  StockAdjustment: StockAdjustmentModel(sequelize),
  StockReturn: StockReturnModel(sequelize),
  StockIssue: StockIssueModel(sequelize),

  // 🔹 Clinical
  Patient: PatientModel(sequelize),
  RegistrationLog: RegistrationLogModel(sequelize),
  Consultation: ConsultationModel(sequelize),
  ConsultationStaff: ConsultationStaffModel(sequelize),
  MedicalRecord: MedicalRecordModel(sequelize),
  TriageRecord: TriageRecordModel(sequelize),
  Vital: VitalModel(sequelize),
  Admission: AdmissionModel(sequelize),
  Appointment: AppointmentModel(sequelize),
  RadiologyRecord: RadiologyRecordModel(sequelize),
  UltrasoundRecord: UltrasoundRecordModel(sequelize),
  DeliveryRecord: DeliveryRecordModel(sequelize),
  MaternityVisit: MaternityVisitModel(sequelize),
  NewbornRecord: NewbornRecordModel(sequelize),
  Message: MessageModel(sequelize),
  MessageAttachment: MessageAttachmentModel(sequelize),
  Recommendation: RecommendationModel(sequelize),
  Prescription: PrescriptionModel(sequelize),
  PrescriptionItem: PrescriptionItemModel(sequelize),
  PharmacyTransaction: PharmacyTransactionModel(sequelize),
  PatientEmployeeLink: PatientEmployeeLinkModel(sequelize),
  LabRequest: LabRequestModel(sequelize),
  LabResult: LabResultModel(sequelize),
  LabRequestItem: LabRequestItemModel(sequelize),
  EKGRecord: EKGRecordModel(sequelize),
  Surgery: SurgeryModel(sequelize), 
  // 🔹 Patient Chart & Records
  PatientChartNote: PatientChartNoteModel(sequelize),
  PatientChartViewLog: PatientChartViewLogModel(sequelize),
  PatientChartCache: PatientChartCacheModel(sequelize),

  // 🔹 Bed/Ward/Room
  Bed: BedModel(sequelize),
  Ward: WardModel(sequelize),
  Room: RoomModel(sequelize),

  // 🔹 System
  AccessViolationLog: AccessViolationLogModel(sequelize),
  Conversation: ConversationModel(sequelize),
  SystemAuditLog: SystemAuditLogModel(sequelize),
};

// 🔗 Associations
Object.values(models).forEach((m) => typeof m.associate === "function" && m.associate(models));

// 📤 Export
export const {
  Organization, Facility, User, Role, UserFacility, Department, Employee,
  RefreshToken, PasswordHistory, Permission, RolePermission, FeatureAccess, FeatureModule,

  // Billing & Refunds
  Invoice, InvoiceItem, InvoiceLineExtension, Payment,
  Refund,
  RefundTransaction,
  RefundDeposit,
  RefundDepositTransaction,  // ✅ Moved here
  Deposit, DepositApplication,
  BillableItem, BillableItemPriceHistory, AutoBillingRule, BillingTrigger, Discount,
  DiscountWaiver, DiscountPolicy, Tax, TaxPolicy, CurrencyRate,
  InsuranceProvider, InsuranceClaim, InsurancePreAuthorization,
  FinancialLedger,

  // Inventory
  MasterItem, MasterItemCategory, CentralStock, DepartmentStock,
  StockRequest, StockRequestItem, Supplier, StockLedger,
  StockAdjustment, StockReturn, StockIssue,

  // Clinical
  Patient, RegistrationLog, Consultation, ConsultationStaff, MedicalRecord,
  TriageRecord, Vital, Admission, Appointment, RadiologyRecord,
  UltrasoundRecord, DeliveryRecord, MaternityVisit, NewbornRecord,
  Message, MessageAttachment, Recommendation, Prescription,
  PrescriptionItem, PharmacyTransaction, PatientEmployeeLink,
  LabRequest, LabResult, LabRequestItem, EKGRecord, Surgery,

  // Patient Chart
  PatientChartNote, PatientChartViewLog, PatientChartCache,

  // Bed/Ward/Room
  Bed, Ward, Room,

  // System
  AccessViolationLog, Conversation, SystemAuditLog,
} = models;


export { sequelize };
export default { sequelize, ...models };
