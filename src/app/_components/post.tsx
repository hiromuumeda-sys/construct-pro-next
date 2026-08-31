"use client";

import { Database, Plus } from "lucide-react";
import { useState } from "react";

import { PageCard } from "~/components/templates/page-template";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export function LatestPost() {
  const [latestPost] = api.post.getLatest.useSuspenseQuery();

  const utils = api.useUtils();
  const [name, setName] = useState("");
  const createPost = api.post.create.useMutation({
    onSuccess: async () => {
      await utils.post.invalidate();
      setName("");
    },
  });

  return (
    <PageCard
      description="tRPCとデータベースの統合デモ"
      title="データベース統合"
      variant="elevated"
    >
      <div className="space-y-6">
        {/* 最新投稿表示 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-primary" />
            <h3 className="font-medium text-foreground text-sm">最新の投稿</h3>
          </div>
          {latestPost ? (
            <Alert>
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {latestPost.name}
                  </span>
                  <Badge variant="secondary">ID: {latestPost.id}</Badge>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription className="text-muted-foreground">
                まだ投稿がありません。下のフォームから最初の投稿を作成してください。
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* 投稿作成フォーム */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            <h3 className="font-medium text-foreground text-sm">新規投稿</h3>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createPost.mutate({ name });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="post-title">投稿タイトル</Label>
              <Input
                id="post-title"
                onChange={(e) => setName(e.target.value)}
                placeholder="投稿のタイトルを入力..."
                type="text"
                value={name}
              />
            </div>
            <Button
              className="w-full"
              disabled={createPost.isPending || !name.trim()}
              type="submit"
            >
              {createPost.isPending ? "送信中..." : "投稿を作成"}
            </Button>
          </form>
        </div>
      </div>
    </PageCard>
  );
}
