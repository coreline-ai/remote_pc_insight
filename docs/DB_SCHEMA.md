# DB_SCHEMA.md — pc-insight Cloud Database Schema (PostgreSQL)
Version: 0.9 (Draft)
Date: 2026-02-03

---

## 0) 코드블럭 깨짐 방지 규칙
- 본 문서는 단일 md 코드블럭 안에서만 제공됨
- 내부에 추가 fenced code block(백틱 3개) 사용 금지
- SQL 예시는 4칸 들여쓰기로만 표기

---

## 1) 개요

pc-insight Cloud는 아래 데이터를 저장합니다.

- 사용자(users)
- 디바이스 등록 토큰(enroll_tokens)
- 디바이스(devices)
- 디바이스 인증 토큰(device_tokens)
- 원격 명령(commands)
- 리포트(reports)
- (v1) 디바이스별 업로드 정책(device_settings)
- (권장) 감사 로그(audit_logs)

기본 원칙:
- 토큰은 DB에 "평문"으로 저장하지 않고 `token_hash`만 저장합니다.
- 리포트는 "요약 컬럼"을 별도 컬럼으로 유지하여 대시보드 쿼리를 빠르게 합니다.
- command queue는 `status` + `created_at` 인덱스로 폴링을 빠르게 합니다.

---

## 2) ID 규칙 / 타입 규칙

### 2.1 ID 규칙
- text 기반 prefix + 랜덤: 예) user_xxx, dev_xxx, cmd_xxx
- 장점: 로그/디버깅에서 엔티티 식별이 쉽고, 분산 환경에서도 충돌이 적음

### 2.2 시간 컬럼
- created_at: 생성 시각
- updated_at: 변경 시각(필요 테이블만)
- last_seen_at: 마지막 접속(heartbeat/agent 호출 시 갱신)

모든 timestamp는 운영 편의상 `timestamptz` 사용 권장

### 2.3 JSON 컬럼
- params_json, raw_report_json 등은 `jsonb` 사용 권장
- 인덱스가 필요하면 GIN 인덱스를 추가로 고려

---

## 3) Enum / 상태 정의

### 3.1 command_status
- queued: 대기
- running: 에이전트가 픽업하여 실행 중
- succeeded: 완료
- failed: 실패
- expired: TTL 만료
- canceled: (v1+) 사용자가 취소한 경우

---

## 4) 테이블 정의 (DDL)

주의: 아래 SQL은 예시이며, 실제 프로젝트에서는 migration 도구(Alembic 등)로 관리 권장

### 4.1 users
목적:
- 웹 로그인 사용자

컬럼:
- id: 사용자 ID (PK)
- email: 이메일(Unique)
- password_hash: 비밀번호 해시(Email+Password 방식일 때)
- created_at

SQL:
    create table if not exists users (
      id text primary key,
      email text not null unique,
      password_hash text,
      created_at timestamptz not null default now()
    );

권장 인덱스:
- email unique (이미 포함)

---

### 4.2 enroll_tokens
목적:
- 웹에서 발급하는 디바이스 등록용 1회성 토큰(단기)

컬럼:
- id (PK)
- user_id (FK -> users.id)
- token_hash (Unique)
- expires_at
- used_at (nullable)
- created_at

SQL:
    create table if not exists enroll_tokens (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );

권장 인덱스:
    create index if not exists idx_enroll_tokens_user_created
      on enroll_tokens(user_id, created_at desc);

---

### 4.3 devices
목적:
- 사용자 소유의 디바이스(PC) 엔티티

컬럼:
- id (PK)
- user_id (FK)
- name
- platform (win32/darwin/linux 등)
- arch (x64/arm64 등)
- fingerprint_hash (옵션: 디바이스 중복 등록 방지용)
- agent_version
- created_at
- last_seen_at
- revoked_at (nullable)

SQL:
    create table if not exists devices (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      name text not null,
      platform text not null,
      arch text not null,
      fingerprint_hash text,
      agent_version text,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz,
      revoked_at timestamptz
    );

권장 인덱스:
    create index if not exists idx_devices_user_lastseen
      on devices(user_id, last_seen_at desc nulls last);

    create index if not exists idx_devices_user_created
      on devices(user_id, created_at desc);

선택 인덱스(중복 등록 방지):
    create index if not exists idx_devices_fingerprint
      on devices(fingerprint_hash);

---

### 4.4 device_tokens
목적:
- 에이전트 인증 토큰(장기, 회수 가능)

컬럼:
- id (PK)
- device_id (FK -> devices.id)
- token_hash (Unique)
- created_at
- expires_at (nullable: 운영 정책에 따라)
- revoked_at
- last_used_at

SQL:
    create table if not exists device_tokens (
      id text primary key,
      device_id text not null references devices(id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default now(),
      expires_at timestamptz,
      revoked_at timestamptz,
      last_used_at timestamptz
    );

권장 인덱스:
    create index if not exists idx_device_tokens_device
      on device_tokens(device_id, created_at desc);

---

### 4.5 commands
목적:
- 웹에서 발행한 원격 점검 명령 큐

컬럼:
- id (PK)
- device_id (FK)
- user_id (FK): 누가 발행했는지 감사/권한용
- type: allowlist
- params_json: 실행 파라미터
- status
- progress (0~100)
- message
- created_at
- started_at
- finished_at
- expires_at (TTL)
- report_id (nullable)
- dedupe_key (nullable): 동일 명령 중복 방지(선택)

SQL:
    create table if not exists commands (
      id text primary key,
      device_id text not null references devices(id) on delete cascade,
      user_id text not null references users(id) on delete cascade,
      type text not null,
      params_json jsonb not null default '{}'::jsonb,
      status text not null,
      progress int not null default 0,
      message text not null default '',
      created_at timestamptz not null default now(),
      started_at timestamptz,
      finished_at timestamptz,
      expires_at timestamptz,
      report_id text,
      dedupe_key text
    );

권장 제약(선택):
- status 체크
    alter table commands
      add constraint commands_status_check
      check (status in ('queued','running','succeeded','failed','expired','canceled'));

권장 인덱스:
    create index if not exists idx_commands_device_status_created
      on commands(device_id, status, created_at asc);

    create index if not exists idx_commands_user_created
      on commands(user_id, created_at desc);

선택 유니크(중복 명령 방지 전략 사용할 때):
- 같은 device_id에 같은 dedupe_key가 queued/running 중복 생성 방지(부분 유니크는 구현 방식에 따라 다름)
- 단순 유니크 대신 애플리케이션 레벨 처리 권장(MVP)

---

### 4.6 reports
목적:
- 에이전트가 업로드한 점검 결과(대시보드용 요약 컬럼 + raw JSON)

컬럼:
- id (PK)
- device_id (FK)
- command_id (nullable FK-like; constraint는 선택)
- created_at
- health_score (대시보드용)
- disk_free_percent (nullable)
- startup_apps_count (nullable)
- one_liner (nullable)
- slowdown_json (jsonb)
- storage_json (jsonb)
- privacy_json (jsonb)
- cleanup_json (jsonb)
- raw_report_json (jsonb)

SQL:
    create table if not exists reports (
      id text primary key,
      device_id text not null references devices(id) on delete cascade,
      command_id text,
      created_at timestamptz not null default now(),
      health_score int,
      disk_free_percent real,
      startup_apps_count int,
      one_liner text,
      slowdown_json jsonb not null default '{}'::jsonb,
      storage_json jsonb not null default '{}'::jsonb,
      privacy_json jsonb not null default '{}'::jsonb,
      cleanup_json jsonb not null default '{}'::jsonb,
      raw_report_json jsonb not null default '{}'::jsonb
    );

권장 인덱스:
    create index if not exists idx_reports_device_created
      on reports(device_id, created_at desc);

    create index if not exists idx_reports_command
      on reports(command_id);

선택 제약(운영 정책에 따라):
- command_id unique (명령당 리포트 1개 원칙일 때)
    create unique index if not exists uq_reports_command_id
      on reports(command_id)
      where command_id is not null;

---

### 4.7 device_settings (v1 권장)
목적:
- 디바이스별 업로드 정책(프라이버시 레벨) 및 기타 설정

컬럼:
- device_id (PK/FK)
- upload_level (0/1/2)
- updated_at
- created_at

SQL:
    create table if not exists device_settings (
      device_id text primary key references devices(id) on delete cascade,
      upload_level int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

권장 제약:
    alter table device_settings
      add constraint device_settings_upload_level_check
      check (upload_level in (0,1,2));

---

### 4.8 audit_logs (권장)
목적:
- 누가/언제/무엇을 했는지(커맨드 생성, revoke 등) 기록

컬럼:
- id (PK)
- user_id (FK)
- device_id (nullable)
- action (text)
- meta_json (jsonb)
- created_at

SQL:
    create table if not exists audit_logs (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      device_id text references devices(id) on delete set null,
      action text not null,
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

권장 인덱스:
    create index if not exists idx_audit_logs_user_created
      on audit_logs(user_id, created_at desc);

    create index if not exists idx_audit_logs_device_created
      on audit_logs(device_id, created_at desc);

---

## 5) 관계/정합성 규칙 (Integrity Rules)

### 5.1 소유권
- devices.user_id는 웹 요청자 user_id와 일치해야 함
- reports는 devices를 join하여 소유권을 검증해야 함
- commands도 동일

### 5.2 revoke 처리
- devices.revoked_at이 not null이면:
  - agent endpoints 접근 거부(디바이스 토큰 검증 단계에서 차단)
  - web에서는 목록에서 숨기거나 별도 "revoked" 섹션 표시

### 5.3 token 회수
- device revoke 시 device_tokens.revoked_at을 일괄 업데이트
- enroll_tokens는 used_at 기록으로 재사용 방지

---

## 6) 성능 설계 포인트 (Indexing & Query Patterns)

### 6.1 대시보드(디바이스 목록)
쿼리 패턴:
- devices by user_id order by last_seen_at desc
- 각 device의 latest report summary subquery

성능 포인트:
- reports(device_id, created_at desc) 인덱스 필수
- 필요 시 materialized view 또는 latest_report_id 컬럼 캐시(v1+)

### 6.2 명령 폴링(/agent/commands/next)
패턴:
- device_id + status=queued order by created_at asc limit 1
- 트랜잭션 + FOR UPDATE SKIP LOCKED 권장
- 인덱스: commands(device_id, status, created_at asc)

### 6.3 리포트 조회
패턴:
- reports by device_id order by created_at desc limit N
- reports by report_id (PK)

---

## 7) 마이그레이션 권장
- Alembic 또는 다른 migration tool 사용 권장
- schema 버전 관리
- 테스트 DB에서 migration CI 수행

---

## 8) 운영 정책(권장 값)

- enroll token TTL: 기본 60분
- command TTL: 기본 15분 (queued 오래 방치 방지)
- running timeout: FULL 10분, DEEP 60분(환경에 따라 조정)
- report 보존:
  - 기본 90일 or 디바이스당 최근 100개
- payload 크기 제한:
  - raw_report_json 최대 2~5MB (초과 시 축약 저장)

---
