-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE "ParticipantRole" AS ENUM ('MEMBER', 'ADMIN');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE');
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
CREATE TYPE "NotificationType" AS ENUM ('NEW_MESSAGE', 'MENTION', 'ADDED_TO_GROUP');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "QueueJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "name" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Conversation_created_by_idx" ON "Conversation"("created_by");
CREATE INDEX "Conversation_updated_at_idx" ON "Conversation"("updated_at" DESC);

CREATE TABLE "DirectConversationKey" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id_low" TEXT NOT NULL,
    "user_id_high" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectConversationKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectConversationKey_conversation_id_key" ON "DirectConversationKey"("conversation_id");
CREATE UNIQUE INDEX "DirectConversationKey_user_id_low_user_id_high_key" ON "DirectConversationKey"("user_id_low", "user_id_high");
CREATE INDEX "DirectConversationKey_user_id_low_idx" ON "DirectConversationKey"("user_id_low");
CREATE INDEX "DirectConversationKey_user_id_high_idx" ON "DirectConversationKey"("user_id_high");

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Message_conversation_id_created_at_idx" ON "Message"("conversation_id", "created_at" DESC);
CREATE INDEX "Message_sender_id_idx" ON "Message"("sender_id");
CREATE INDEX "Message_conversation_id_idx" ON "Message"("conversation_id");

CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "last_read_message_id" TEXT,
    "unread_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationParticipant_conversation_id_user_id_key" ON "ConversationParticipant"("conversation_id", "user_id");
CREATE INDEX "ConversationParticipant_user_id_idx" ON "ConversationParticipant"("user_id");
CREATE INDEX "ConversationParticipant_conversation_id_idx" ON "ConversationParticipant"("conversation_id");

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_user_id_created_at_idx" ON "Notification"("user_id", "created_at" DESC);

CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "QueueJobStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "last_error" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QueueJob_status_available_at_idx" ON "QueueJob"("status", "available_at");
CREATE INDEX "QueueJob_type_idx" ON "QueueJob"("type");

CREATE TABLE "DeadLetterJob" (
    "id" TEXT NOT NULL,
    "original_job_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL,
    "failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadLetterJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeadLetterJob_failed_at_idx" ON "DeadLetterJob"("failed_at" DESC);

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectConversationKey" ADD CONSTRAINT "DirectConversationKey_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectConversationKey" ADD CONSTRAINT "DirectConversationKey_user_id_low_fkey" FOREIGN KEY ("user_id_low") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectConversationKey" ADD CONSTRAINT "DirectConversationKey_user_id_high_fkey" FOREIGN KEY ("user_id_high") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
