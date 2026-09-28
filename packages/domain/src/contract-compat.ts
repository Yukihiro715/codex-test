/**
 * 設計契約（contracts/domain.ts）との互換性を型で検査する。
 * 実装側の型を広げても、契約の形に代入できることを typecheck で保証する。
 */
import type * as Contract from '../../../contracts/domain';
import type { ClickDecision, PublicJob, Salary, SourceListing, SourcePolicy } from './types';

type Assert<T extends true> = T;
type AssignableTo<A, B> = [A] extends [B] ? true : false;

export type ContractChecks = [
  Assert<AssignableTo<PublicJob, Contract.PublicJob>>,
  Assert<AssignableTo<SourcePolicy, Contract.SourcePolicy>>,
  Assert<AssignableTo<Salary, Contract.Salary>>,
  Assert<AssignableTo<ClickDecision, Contract.ClickDecision>>,
  Assert<AssignableTo<SourceListing, Contract.SourceListing>>,
];
