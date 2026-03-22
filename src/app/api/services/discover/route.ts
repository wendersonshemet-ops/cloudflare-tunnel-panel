import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { createService } from "@/lib/repository";
import { discoverLocalServices } from "@/lib/service-discovery";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST() {
  const auth = await requireApiAuth();
  if (auth) return auth;
  try {
    const result = await discoverLocalServices();
    const created = [];

    for (const service of result.discovered) {
      try {
        created.push(createService({
          name: service.name,
          scheme: service.scheme,
          host: service.host,
          port: service.port,
          healthCheckPath: service.healthCheckPath,
          source: service.source,
        }));
      } catch {
        // duplicate, ignore
      }
    }

    return ok({
      ...result,
      importedCount: created.length,
      imported: created,
    });
  } catch (error) {
    return fail(fromUnknownError(error, "服务发现失败"), statusFromError(error, 500));
  }
}