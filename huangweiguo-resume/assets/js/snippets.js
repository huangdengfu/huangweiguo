/* 代码示例数据：所有片段均为可运行的学习 / 实验环境示例 */
window.SNIPPETS = {
  python: [
    {
      tab: "设备巡检",
      file: "net_probe.py",
      desc: "并发探测设备管理端口（22 / 23），一轮就能完成机房设备可达性巡检，替代逐台手工 ping 与 telnet。",
      points: [
        "socket.connect_ex() 返回 0 表示端口可达，比 ping 更贴近“管理面是否真的通”",
        "ThreadPoolExecutor 控制并发数，避免几十台设备同时探测把链路打满",
        "with 语句确保套接字释放，异常时不会留下僵尸连接"
      ],
      code: String.raw`# net_probe.py —— 并发探测设备管理端口，一轮完成机房可达性巡检
import socket
from concurrent.futures import ThreadPoolExecutor

DEVICES = [
    ("SW-Core  核心交换机", "192.168.10.1",   22),
    ("SW-A1    接入交换机", "192.168.10.11",  22),
    ("R1       出口路由器", "192.168.10.254", 23),
]

def probe(item):
    name, host, port = item
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1.5)
        reachable = sock.connect_ex((host, port)) == 0
    return name, host, port, reachable

def main():
    with ThreadPoolExecutor(max_workers=8) as pool:
        for name, host, port, ok in pool.map(probe, DEVICES):
            flag = "[ UP ]" if ok else "[DOWN]"
            print(f"{flag} {name:<20} {host}:{port}")

if __name__ == "__main__":
    main()`
    },
    {
      tab: "日志报表",
      file: "log_report.py",
      desc: "用正则从交换机日志里提取链路 UP / DOWN 事件，直接导出可直接交付的 CSV 报表，省掉手工筛选。",
      points: [
        "命名分组 (?P<name>…) 让提取结果自带字段名，代码可读性更好",
        "逐行读取而不是 read()，大日志文件也不会吃满内存",
        "utf-8-sig 编码让 Excel 打开中文表头不乱码"
      ],
      code: String.raw`# log_report.py —— 从交换机日志中提取链路状态事件，导出 CSV 报表
import csv
import re

PATTERN = re.compile(
    r"(?P<time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?"
    r"(?P<iface>GE\d/\d/\d).*?is\s+(?P<state>UP|DOWN)",
    re.IGNORECASE,
)

def collect(path):
    events = []
    with open(path, encoding="utf-8", errors="ignore") as log:
        for line in log:
            hit = PATTERN.search(line)
            if hit:
                events.append(hit.groupdict())
    return events

def export(events, path="link_events.csv"):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["time", "iface", "state"])
        writer.writeheader()
        writer.writerows(events)

if __name__ == "__main__":
    rows = collect("switch.log")
    export(rows)
    down = [r for r in rows if r["state"] == "DOWN"]
    print(f"共 {len(rows)} 条事件，其中 DOWN {len(down)} 条 -> link_events.csv")`
    },
    {
      tab: "子网规划",
      file: "subnet_plan.py",
      desc: "把 VLAN 地址规划交给 ipaddress 模块：掩码、可用主机数、地址范围、广播地址一次算清，避免手算出错。",
      points: [
        "ip_network(strict=False) 允许传入带主机位的地址，不会直接报错",
        "hosts() 自动排除网络地址与广播地址，可用范围一目了然",
        "按“需求主机数”校验网段够不够用，规划阶段就能发现问题"
      ],
      code: String.raw`# subnet_plan.py —— 子网规划：掩码、可用地址范围、广播地址一次算清
import ipaddress

def plan(cidr, need_hosts=0):
    net = ipaddress.ip_network(cidr, strict=False)
    usable = net.num_addresses - 2
    judge = "够用" if usable >= need_hosts else "不足"
    print(f"{cidr:<18} 掩码 {net.netmask}")
    print(f"  可用主机 {usable:>4} 个 / 需求 {need_hosts} 个 -> {judge}")

    if usable > 0:
        hosts = list(net.hosts())
        print(f"  地址范围 {hosts[0]} ~ {hosts[-1]}")
    print(f"  广播地址 {net.broadcast_address}\n")

if __name__ == "__main__":
    PLAN = [
        ("192.168.10.0/24", 60),   # VLAN 10 办公
        ("192.168.20.0/26", 60),   # VLAN 20 教学
        ("192.168.30.0/26", 30),   # VLAN 30 服务器
        ("192.168.99.0/28", 10),   # VLAN 99 设备管理
    ]
    for cidr, need in PLAN:
        plan(cidr, need)`
    }
  ],

  java: [
    {
      tab: "TCP 服务端",
      file: "DeviceServer.java",
      desc: "线程池 + ServerSocket 的 TCP 服务端，可同时响应多台客户端的查询请求，理解“一个连接一个会话”的真实含义。",
      points: [
        "ExecutorService 复用线程，避免每来一个连接就 new Thread 把系统压垮",
        "try-with-resources 自动关闭 Socket 与流，客户端断开也不会泄漏资源",
        "字符流显式指定 UTF-8，中文回显不乱码"
      ],
      code: String.raw`// DeviceServer.java —— 线程池 + ServerSocket，同时响应多台客户端的查询
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DeviceServer {
    private static final int PORT = 9000;
    private static final ExecutorService POOL = Executors.newFixedThreadPool(8);

    public static void main(String[] args) throws IOException {
        try (ServerSocket server = new ServerSocket(PORT)) {
            System.out.println("DeviceServer listening on " + PORT);
            while (true) {
                Socket client = server.accept();
                POOL.execute(() -> handle(client));
            }
        }
    }

    private static void handle(Socket client) {
        try (Socket socket = client;
             BufferedReader in = new BufferedReader(
                     new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             PrintWriter out = new PrintWriter(
                     new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8), true)) {

            String cmd = in.readLine();
            String reply = "SW-Core".equals(cmd) ? "GE0/0/1 UP" : "UNKNOWN DEVICE";
            out.println(reply);
        } catch (IOException e) {
            System.err.println("连接异常: " + e.getMessage());
        }
    }
}`
    },
    {
      tab: "HTTP 报文",
      file: "HttpProbe.java",
      desc: "不借助 HttpURLConnection，手动拼装 HTTP/1.1 请求，直观看到“请求行 + 头部 + 空行”的结构，以及服务器返回的响应头。",
      points: [
        "CRLF（\\r\\n）分隔请求行与各头部，最后必须有一个空行，否则服务器一直等",
        "setSoTimeout 设置读超时，避免服务端不响应时程序僵死",
        "这段代码也说明：HTTP 就是跑在 TCP 之上的文本协议"
      ],
      code: String.raw`// HttpProbe.java —— 手写 HTTP/1.1 请求，观察响应报文结构
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public class HttpProbe {
    public static void main(String[] args) throws IOException {
        try (Socket socket = new Socket("example.com", 80)) {
            socket.setSoTimeout(3000);

            PrintWriter out = new PrintWriter(
                    new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8), true);
            out.print("GET / HTTP/1.1\r\n"
                    + "Host: example.com\r\n"
                    + "Connection: close\r\n"
                    + "\r\n");

            BufferedReader in = new BufferedReader(
                    new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
            String line;
            while ((line = in.readLine()) != null) {
                System.out.println(line);
                if (line.isEmpty()) {
                    break;   // 头部结束，之后是报文体
                }
            }
        }
    }
}`
    },
    {
      tab: "设备台账",
      file: "Inventory.java",
      desc: "用 record 与 Stream 管理设备台账，按 VLAN 自动分组输出，对应运维中“按区域盘点资产”的日常需求。",
      points: [
        "record 一行定义不可变数据载体，省掉大量 getter 与构造方法",
        "Collectors.groupingBy 按 VLAN 分组，等价于 SQL 的 GROUP BY",
        "joining 把设备名拼成一行，可直接贴进交接文档"
      ],
      code: String.raw`// Inventory.java —— 用 record 与 Stream 管理设备台账，按 VLAN 分组
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

record Device(String name, String model, String ip, int vlan) {}

public class Inventory {
    public static void main(String[] args) {
        List<Device> devices = List.of(
                new Device("SW-Core", "S5700", "192.168.10.1", 1),
                new Device("SW-A1",   "S3700", "192.168.10.11", 10),
                new Device("SW-A2",   "S3700", "192.168.20.12", 20),
                new Device("SW-A3",   "S3700", "192.168.30.13", 30)
        );

        Map<Integer, List<Device>> byVlan = devices.stream()
                .collect(Collectors.groupingBy(Device::vlan));

        byVlan.forEach((vlan, list) -> System.out.printf(
                "VLAN %-3d -> %s%n", vlan,
                list.stream().map(Device::name).collect(Collectors.joining(", "))));
    }
}`
    }
  ],

  config: {
    huawei: String.raw`<Huawei> system-view
[Huawei] sysname SW-Core

# 1. 创建 VLAN（办公 / 教学 / 服务器 / 管理）
[SW-Core] vlan batch 10 20 30 99

# 2. 上联口：Trunk，只放行必要 VLAN
[SW-Core] interface GigabitEthernet0/0/1
[SW-Core-GigabitEthernet0/0/1] port link-type trunk
[SW-Core-GigabitEthernet0/0/1] port trunk allow-pass vlan 10 20 30
[SW-Core-GigabitEthernet0/0/1] quit

# 3. 三层网关：每个 VLAN 一个 Vlanif
[SW-Core] interface Vlanif 10
[SW-Core-Vlanif10] ip address 192.168.10.254 24
[SW-Core-Vlanif10] quit
[SW-Core] interface Vlanif 20
[SW-Core-Vlanif20] ip address 192.168.20.254 24
[SW-Core-Vlanif20] quit

# 4. 默认路由指向出口路由器
[SW-Core] ip route-static 0.0.0.0 0.0.0.0 192.168.10.1

# 5. ACL：禁止教学区访问服务器区 3389，其余放行
[SW-Core] acl number 3000
[SW-Core-acl-adv-3000] rule 5 deny tcp source 192.168.20.0 0.0.0.255 destination 192.168.30.0 0.0.0.255 destination-port eq 3389
[SW-Core-acl-adv-3000] rule 10 permit ip
[SW-Core-acl-adv-3000] quit
[SW-Core] interface Vlanif 20
[SW-Core-Vlanif20] traffic-filter inbound acl 3000
[SW-Core-Vlanif20] quit

# 6. 保存配置
[SW-Core] save`,

    cisco: String.raw`Router> enable
Router# configure terminal

! 1. 基础配置
Router(config)# hostname SW-Core
SW-Core(config)# vlan 10
SW-Core(config-vlan)# name OFFICE
SW-Core(config-vlan)# vlan 20
SW-Core(config-vlan)# name TEACH
SW-Core(config-vlan)# exit

! 2. 上联口：Trunk（3560 需先指定封装）
SW-Core(config)# interface fastEthernet 0/1
SW-Core(config-if)# switchport trunk encapsulation dot1q
SW-Core(config-if)# switchport mode trunk
SW-Core(config-if)# switchport trunk allowed vlan 10,20,30
SW-Core(config-if)# exit

! 3. 三层交换：开启路由 + SVI 网关
SW-Core(config)# ip routing
SW-Core(config)# interface vlan 10
SW-Core(config-if)# ip address 192.168.10.254 255.255.255.0
SW-Core(config-if)# no shutdown
SW-Core(config-if)# exit
SW-Core(config)# interface vlan 20
SW-Core(config-if)# ip address 192.168.20.254 255.255.255.0

! 4. 默认路由与 OSPF
SW-Core(config)# ip route 0.0.0.0 0.0.0.0 192.168.10.1
SW-Core(config)# router ospf 1
SW-Core(config-router)# network 192.168.0.0 0.0.255.255 area 0

! 5. 限制 VTY 登录来源
SW-Core(config)# access-list 10 permit 192.168.99.0 0.0.0.255
SW-Core(config)# line vty 0 4
SW-Core(config-line)# access-class 10 in
SW-Core(config-line)# end

! 6. 保存配置
SW-Core# write memory`
  }
};
