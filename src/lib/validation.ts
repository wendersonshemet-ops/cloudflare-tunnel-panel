import { z } from "zod";

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "服务名不能为空"),
  scheme: z.enum(["http", "https"]),
  host: z.string()
    .trim()
    .min(1, "主机不能为空")
    .refine((value) => !/\s/.test(value), "主机地址不能包含空格"),
  port: z.coerce.number()
    .int("端口必须是整数")
    .min(1, "端口范围必须在 1 到 65535 之间")
    .max(65535, "端口范围必须在 1 到 65535 之间"),
  healthCheckPath: z.string()
    .trim()
    .min(1, "健康检查路径不能为空")
    .refine((value) => value.startsWith("/"), "健康检查路径必须以 / 开头")
    .default("/"),
  source: z.enum(["manual", "docker", "systemd", "process"]).default("manual"),
});

export const bindingSchema = z.object({
  zoneId: z.string().trim().min(1, "请选择一个 Zone"),
  zoneName: z.string().trim().min(1, "Zone 名称不能为空"),
  hostname: z.string()
    .trim()
    .min(3, "Hostname 不能为空")
    .regex(/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/, "Hostname 格式不正确，请使用形如 sub.example.com 的域名"),
  serviceId: z.string().trim().min(1, "请选择目标服务"),
  tunnelId: z.string().trim().min(1, "请选择一个 Tunnel"),
  tunnelName: z.string().trim().min(1, "Tunnel 名称不能为空"),
});
