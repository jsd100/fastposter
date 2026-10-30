namespace go core

struct PingRequest { 1: required string requestId }
struct PingResponse { 1: required string requestId, 2: required string message }

service CoreService {
 PingResponse Ping(1: PingRequest request)
}
