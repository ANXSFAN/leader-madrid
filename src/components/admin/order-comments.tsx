"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, X, Loader2 } from "lucide-react";
import { addOrderComment, deleteOrderComment } from "@/lib/actions/order-comments";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface OrderComment {
  id: string;
  content: string;
  createdAt: Date | string;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface OrderCommentsProps {
  orderId: string;
  initialComments: OrderComment[];
}

export function OrderComments({ orderId, initialComments }: OrderCommentsProps) {
  const t = useTranslations("admin.orderComments");
  const [comments, setComments] = useState<OrderComment[]>(initialComments);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      const result = await addOrderComment(orderId, content);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("comment_added"));
      setContent("");
      // Refresh comments from server
      const { getOrderComments } = await import("@/lib/actions/order-comments");
      const updated = await getOrderComments(orderId);
      setComments(updated);
    });
  };

  const handleDelete = (commentId: string) => {
    if (!confirm(t("confirm_delete"))) return;

    startTransition(async () => {
      const result = await deleteOrderComment(commentId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("comment_deleted"));
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  };

  const getInitials = (comment: OrderComment) => {
    if (comment.user.name) {
      return comment.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return comment.user.email[0].toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base border-l-4 border-yellow-500 pl-3">
          <MessageSquare className="h-5 w-5" />
          {t("title")}
          <Badge variant="secondary" className="ml-1">
            {comments.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("no_comments")}
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex gap-3 group rounded-lg p-3 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(comment)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {comment.user.name || comment.user.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(comment.id)}
                  disabled={isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add Comment Form */}
        <form onSubmit={handleSubmit} className="border-t pt-4 space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("placeholder")}
            className="min-h-[80px] resize-none"
            disabled={isPending}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold"
              disabled={isPending || !content.trim()}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t("submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
