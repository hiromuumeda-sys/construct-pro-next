/**
 * ホームページテンプレート
 *
 * このページは Sun Next.js Template のデモンストレーション用のテンプレートです。
 * プロジェクトの要件に応じて、このファイルの内容を全て作り直すことを前提としています。
 *
 * 以下の要素は参考実装として提供されています：
 * - デザインシステムのコンポーネント使用例
 * - tRPCを使用したAPI通信のデモ
 * - ページレイアウトとセクション構成の例
 *
 * 実際のプロジェクトでは、このファイルを削除するか、
 * プロジェクト固有のコンテンツで完全に置き換えてください。
 */
import {
  BookOpen,
  Box,
  Code,
  ExternalLink,
  Palette,
  Ruler,
  Sparkles,
  Type,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { LatestPost } from "~/app/_components/post";
import {
  PageCard,
  PageGrid,
  PageHero,
  PageSection,
  PageTemplate,
} from "~/components/templates/page-template";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });

  api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <PageTemplate
        description="Next.js フルスタック開発テンプレート - T3 Stack with デザインシステム"
        title="Sun Next.js Template"
      >
        {/* ヒーローセクション */}
        <PageHero
          actions={
            <>
              <Link href="/design-system">
                <Button className="h-11 shadow-lg" size="lg">
                  <Box className="mr-2 size-5" />
                  デザインシステムを見る
                </Button>
              </Link>
              <Link href="https://create.t3.gg" target="_blank">
                <Button className="h-11 shadow-md" size="lg" variant="outline">
                  <BookOpen className="mr-2 size-5" />
                  ドキュメント
                  <ExternalLink className="ml-2 size-4" />
                </Button>
              </Link>
            </>
          }
          badges={[
            {
              label: "フルスタックテンプレート",
              icon: <Sparkles className="size-3.5" />,
              variant: "secondary",
              className: "bg-primary/15 text-primary border-primary/30",
            },
            {
              label: "T3 Stack",
              icon: <Zap className="size-3.5" />,
              variant: "secondary",
              className:
                "bg-secondary/15 text-secondary-foreground border-secondary/30",
            },
          ]}
          description="TypeScript、tRPC、Tailwind CSSを統合したエンタープライズグレードのNext.jsテンプレート。型安全なフルスタック開発を今すぐ始めましょう。"
          gradient="primary"
          title={
            <>
              モダンな開発体験を
              <br />
              すぐに始められる
            </>
          }
        />

        {/* デザインシステムセクション */}
        <PageSection
          description="統一されたデザイントークンとコンポーネントで、一貫性のある美しいUIを構築"
          spacing="lg"
          title="デザインシステム"
        >
          <PageGrid cols={2} gap="lg">
            <Link className="group" href="/design-system/colors">
              <PageCard
                description="OKLCH色空間による美しいカラーパレット"
                hover
                title="カラーシステム"
                variant="elevated"
              >
                <div className="flex items-center justify-between pt-2">
                  <Palette className="size-12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:text-primary/80" />
                  <div className="flex gap-2">
                    <div className="size-10 rounded-lg bg-primary shadow-md transition-transform group-hover:scale-110" />
                    <div className="size-10 rounded-lg bg-secondary shadow-md transition-transform group-hover:scale-110" />
                    <div className="size-10 rounded-lg bg-accent shadow-md transition-transform group-hover:scale-110" />
                  </div>
                </div>
              </PageCard>
            </Link>
            <Link className="group" href="/design-system/typography">
              <PageCard
                description="読みやすさを追求したタイポグラフィシステム"
                hover
                title="タイポグラフィ"
                variant="elevated"
              >
                <div className="flex items-center justify-between pt-2">
                  <Type className="size-12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:text-primary/80" />
                  <div className="space-y-2 text-right">
                    <div className="font-bold text-2xl text-foreground transition-all group-hover:text-primary">
                      Aa
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Noto Sans JP
                    </div>
                  </div>
                </div>
              </PageCard>
            </Link>
            <Link className="group" href="/design-system/spacing">
              <PageCard
                description="統一された余白設計による調和のとれたレイアウト"
                hover
                title="スペーシング"
                variant="elevated"
              >
                <div className="flex w-full items-center justify-between pt-2">
                  <Ruler className="size-12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:text-primary/80" />
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-2 rounded-md bg-muted shadow-sm transition-all group-hover:bg-primary/30" />
                    <div className="h-10 w-4 rounded-md bg-muted shadow-sm transition-all group-hover:bg-primary/30" />
                    <div className="h-10 w-6 rounded-md bg-muted shadow-sm transition-all group-hover:bg-primary/30" />
                    <div className="h-10 w-10 rounded-md bg-primary shadow-md transition-all group-hover:scale-110" />
                  </div>
                </div>
              </PageCard>
            </Link>
            <Link className="group" href="/design-system/components">
              <PageCard
                description="再利用可能なUIコンポーネントライブラリ"
                hover
                title="コンポーネント"
                variant="elevated"
              >
                <div className="flex w-full items-center justify-between pt-2">
                  <Code className="size-12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:text-primary/80" />
                  <div className="flex flex-col gap-2.5">
                    <div className="h-7 w-20 rounded-lg border border-border/60 bg-background shadow-md transition-all group-hover:border-primary/50 group-hover:shadow-lg" />
                    <div className="h-7 w-24 rounded-lg border-2 border-primary/30 bg-primary/10 shadow-sm transition-all group-hover:border-primary/50 group-hover:bg-primary/20" />
                  </div>
                </div>
              </PageCard>
            </Link>
          </PageGrid>
        </PageSection>

        {/* T3 スタックリソース */}
        <PageSection
          description="強力なフルスタック開発を始めるための公式ドキュメントとガイド"
          spacing="lg"
          title="リソース"
        >
          <PageGrid cols={2} gap="lg">
            <Link
              className="group"
              href="https://create.t3.gg/en/usage/first-steps"
              target="_blank"
            >
              <PageCard
                description="データベースと認証のセットアップガイド"
                hover
                title="First Steps"
                variant="elevated"
              >
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-primary/10 p-3.5 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md">
                      <BookOpen className="size-7 text-primary" />
                    </div>
                    <Badge className="shadow-sm" variant="outline">
                      ガイド
                    </Badge>
                  </div>
                  <ExternalLink className="size-6 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
              </PageCard>
            </Link>
            <Link
              className="group"
              href="https://create.t3.gg/en/introduction"
              target="_blank"
            >
              <PageCard
                description="T3 Stackの詳細ドキュメント"
                hover
                title="Documentation"
                variant="elevated"
              >
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-secondary/10 p-3.5 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md">
                      <BookOpen className="size-7 text-secondary-foreground" />
                    </div>
                    <Badge className="shadow-sm" variant="outline">
                      ドキュメント
                    </Badge>
                  </div>
                  <ExternalLink className="size-6 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
              </PageCard>
            </Link>
          </PageGrid>
        </PageSection>

        {/* tRPC デモ */}
        <PageSection
          description="エンドツーエンドで型安全なサーバー・クライアント間通信を実現"
          spacing="lg"
          title="tRPC デモ"
        >
          <PageGrid cols={2} gap="lg">
            <PageCard
              description="tRPCによる型安全なAPI通信を体験"
              title="サーバー通信テスト"
              variant="elevated"
            >
              <div className="space-y-5 pt-2">
                <div className="flex items-center gap-3">
                  <Badge
                    className="bg-primary/10 text-primary shadow-sm"
                    variant="secondary"
                  >
                    <Zap className="mr-1.5 size-3.5" />
                    型安全
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    TypeScript
                  </span>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-5 shadow-inner">
                  <div className="space-y-3">
                    <div className="font-semibold text-foreground text-sm">
                      Response:
                    </div>
                    <p className="font-mono text-base text-primary leading-relaxed">
                      {hello ? hello.greeting : "Loading tRPC query..."}
                    </p>
                  </div>
                </div>
              </div>
            </PageCard>

            {/* 最新投稿 */}
            <LatestPost />
          </PageGrid>
        </PageSection>
      </PageTemplate>
    </HydrateClient>
  );
}
