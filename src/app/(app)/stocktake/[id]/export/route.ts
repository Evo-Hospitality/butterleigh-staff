import { requireAppAccess } from "@/lib/auth";
import { buildStockTakeSheet } from "@/lib/stocktake/sheet";
import { stockTakeFileName, stockTakeWorkbook } from "@/lib/stocktake/workbook";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Same gate as the page it's downloaded from — a direct link to the file
  // shouldn't be a way round the app's access rules.
  const { supabase } = await requireAppAccess("stocktake");
  const { id } = await params;

  const sheet = await buildStockTakeSheet(supabase, id);
  if (!sheet) {
    return new Response("Not found", { status: 404 });
  }
  if (sheet.stockTake.status === "draft") {
    return new Response("That stocktake hasn't been submitted yet", { status: 400 });
  }

  const buffer = await stockTakeWorkbook(sheet);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${stockTakeFileName(sheet)}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
