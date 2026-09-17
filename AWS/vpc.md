# VPC (Virtual Private Cloud)

A VPC is your own logically isolated network within AWS, defined by one or more CIDR blocks (e.g. `10.0.0.0/16`), inside which you provision subnets, route tables, gateways, and the resources that use them. Nothing in a VPC is reachable from outside it, or from another VPC, unless you explicitly wire up connectivity — that default-deny posture is the whole point: AWS gives you the raw network primitives (IP addressing, routing, gateways, ACLs) and you compose them into whatever topology your workload needs, from a single flat public subnet to a multi-tier, multi-AZ, hub-and-spoke enterprise network.

A subnet is a subdivision of the VPC's CIDR block tied to exactly one Availability Zone. Whether a subnet is "public" or "private" is not an inherent property of the subnet — it's entirely determined by its route table. A public subnet's route table has a route sending `0.0.0.0/0` traffic to an Internet Gateway (IGW), so resources with public IPs in it can be reached from, and can reach, the internet directly. A private subnet's route table has no such route — its resources cannot be reached from the internet and cannot initiate outbound internet connections on their own. To let private-subnet resources reach the internet outbound (say, to pull OS patches or call an external API) without being inbound-reachable, you route their `0.0.0.0/0` traffic to a NAT Gateway sitting in a public subnet. NAT Gateway is a managed, highly available (within its AZ) service billed per-hour-plus-per-GB; a NAT instance is just an EC2 box running NAT software that you patch, scale, and fail over yourself — it's cheaper at low volume but is a legacy pattern AWS generally discourages for anything beyond a small dev environment.

Connectivity between VPCs is where the architecture choices matter most. VPC Peering creates a direct 1:1 connection between two VPCs, routable via entries you add to each side's route tables — but it is strictly non-transitive: if VPC A is peered with B, and B is peered with C, A cannot reach C through B. You'd need a direct A-C peering, and this gets combinatorially painful as the number of VPCs grows (n VPCs need up to n(n-1)/2 peering connections for full mesh connectivity). Transit Gateway solves this by acting as a regional network hub: every attached VPC (and VPN, and Direct Connect connection) gets a single attachment to the Transit Gateway, and routing between them is governed by Transit Gateway route tables, giving you transitive routing without a peering mesh — this is the standard pattern once you have more than a handful of VPCs to connect.

VPC Endpoints let resources inside a VPC reach AWS services without their traffic ever touching the public internet or needing a NAT Gateway/IGW. Gateway Endpoints are free and only support S3 and DynamoDB — they work by adding a target entry to your route table that points matching traffic at the service via AWS's internal network. Interface Endpoints (built on AWS PrivateLink) work for most other AWS services (and even third-party/partner services) by provisioning an Elastic Network Interface with a private IP inside your subnet; they cost an hourly charge plus per-GB data processing, but let you reach essentially any supported service privately, including cross-account.

## Examples

```bash
# Create a VPC and a public subnet, then wire up the Internet Gateway route
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications \
  'ResourceType=vpc,Tags=[{Key=Name,Value=prod-vpc}]'

aws ec2 create-subnet --vpc-id vpc-0123456789abcdef0 \
  --cidr-block 10.0.1.0/24 --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-1a}]'

aws ec2 create-internet-gateway --tag-specifications \
  'ResourceType=internet-gateway,Tags=[{Key=Name,Value=prod-igw}]'
aws ec2 attach-internet-gateway --vpc-id vpc-0123456789abcdef0 --internet-gateway-id igw-0abc123

# Route 0.0.0.0/0 from the public route table to the IGW
aws ec2 create-route --route-table-id rtb-0123456789abcdef0 \
  --destination-cidr-block 0.0.0.0/0 --gateway-id igw-0abc123
```
This is the minimum wiring that turns a bare subnet into a "public" one — a CIDR block alone gives you nothing until the route table actually points default traffic at the IGW.

```yaml
# CloudFormation snippet: S3 Gateway Endpoint attached to a private route table
S3GatewayEndpoint:
  Type: AWS::EC2::VPCEndpoint
  Properties:
    VpcId: !Ref MyVpc
    ServiceName: !Sub com.amazonaws.${AWS::Region}.s3
    VpcEndpointType: Gateway
    RouteTableIds:
      - !Ref PrivateRouteTable
```
This lets private-subnet instances (e.g. app servers with no NAT Gateway) read/write S3 without any internet path, at no additional cost — a common cost-and-security win for workloads that talk mostly to S3/DynamoDB.

```bash
# Peer two VPCs and add the routes each side needs to reach the other's CIDR
aws ec2 create-vpc-peering-connection \
  --vpc-id vpc-0111111111111 --peer-vpc-id vpc-0222222222222

aws ec2 accept-vpc-peering-connection --vpc-peering-connection-id pcx-0abc123

aws ec2 create-route --route-table-id rtb-aaaa \
  --destination-cidr-block 10.1.0.0/16 --vpc-peering-connection-id pcx-0abc123
aws ec2 create-route --route-table-id rtb-bbbb \
  --destination-cidr-block 10.0.0.0/16 --vpc-peering-connection-id pcx-0abc123
```
Peering requires routes on *both* sides and non-overlapping CIDR blocks; forgetting the return route is one of the most common "why can't B reach A" support tickets.

## Common Pitfalls / Gotchas

- Assuming VPC Peering is transitive — it is not. A-B and B-C peering never lets A reach C; you need Transit Gateway or a direct A-C peering.
- Overlapping CIDR blocks between VPCs you plan to peer or connect via Transit Gateway — this cannot be fixed with routing and requires re-IP'ing one side.
- Forgetting that a NAT Gateway is AZ-scoped: if it sits only in `us-east-1a` and your private subnet is in `us-east-1b`, cross-AZ NAT traffic works but creates a single point of failure and cross-AZ data transfer charges — production designs put a NAT Gateway in each AZ.
- Treating "public subnet" as a fixed label rather than a route-table consequence — an instance with a public IP in a subnet whose route table lacks an IGW route is still unreachable from the internet, and vice versa if someone edits the route table later.
- Using Interface Endpoints without also attaching a security group that allows the traffic — unlike Gateway Endpoints, Interface Endpoints are ENIs and are subject to security group rules.
- Not accounting for VPC Endpoint hourly + per-GB cost at scale — Interface Endpoints for high-traffic services (e.g. many services fanning out to Secrets Manager) can add up quickly compared to the free Gateway Endpoints for S3/DynamoDB.

## Interview Questions & Answers

**Q: What makes a subnet "public" versus "private"?**
A: Purely its route table. A subnet is public if its route table has a route sending `0.0.0.0/0` (or a relevant CIDR) to an Internet Gateway. There's no separate flag on the subnet itself — you can make a subnet public or private at any time just by editing its route table, and resources' actual reachability follows immediately.

**Q: Why isn't VPC Peering transitive, and what do you use instead when you have many VPCs to connect?**
A: Peering connections are point-to-point routing relationships added explicitly to each side's route tables; there's no mechanism for a peering connection to forward traffic on to a third VPC. For more than a few VPCs, you use Transit Gateway, a regional routing hub that every VPC attaches to once, giving you transitive routing managed through Transit Gateway route tables instead of an ever-growing peering mesh.

**Q: What's the difference between a Gateway Endpoint and an Interface Endpoint?**
A: A Gateway Endpoint is a route-table target, free of charge, and only supports S3 and DynamoDB. An Interface Endpoint is an ENI with a private IP provisioned via AWS PrivateLink, billed hourly plus per-GB, and supports most other AWS services (and PrivateLink-enabled third-party services). Both keep traffic off the public internet, but Interface Endpoints are also subject to security group rules since they're actual network interfaces.

**Q: A private-subnet EC2 instance needs to call an external HTTPS API. What do you need to provision?**
A: A NAT Gateway in a public subnet (with its own Elastic IP), plus a route in the private subnet's route table sending `0.0.0.0/0` to that NAT Gateway. The NAT Gateway itself needs the public subnet's IGW route to actually reach the internet. The private instance never gets a public IP and is never inbound-reachable — only its outbound-initiated connections get NAT'd.

**Q: How would you design VPC connectivity for 20 VPCs across several teams that all need to reach a shared services VPC?**
A: Avoid full-mesh peering (which would need up to 190 connections and doesn't even give transitivity). Use a Transit Gateway as the hub: attach all 20 team VPCs plus the shared services VPC to it, and use Transit Gateway route tables to control which VPCs can reach which — e.g. restricting team VPCs to only reach shared services, not each other, by segmenting route table associations.

## Related Topics
- [elastic-load-balancing.md](./elastic-load-balancing.md)
- [network-security.md](./network-security.md)
- [route-53.md](./route-53.md)
- [fault-isolation.md](./fault-isolation.md)
- [ec2.md](./ec2.md)
- [cloudformation.md](./cloudformation.md)
