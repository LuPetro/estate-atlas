import { LogController, type FastifyRequest, type FastifyReply } from 'fastify';
// Framework stream/serialization errors must follow the same privacy rules as our handler.
export class PrivateLogs extends LogController {
  constructor() {
    super({ disableRequestLogging: true });
  }
  incomingRequest() {}
  requestCompleted() {}
  routeNotFound() {}
  defaultErrorLog(_error: Error, request: FastifyRequest, reply: FastifyReply) {
    request.log.error(
      { route: request.routeOptions.url ?? 'unmatched', status: reply.statusCode },
      'Request processing failed',
    );
  }
  streamError(error: Error, request: FastifyRequest, reply: FastifyReply) {
    this.defaultErrorLog(error, request, reply);
  }
  writeHeadError(error: Error, request: FastifyRequest, reply: FastifyReply) {
    this.defaultErrorLog(error, request, reply);
  }
  serializerError(error: Error, request: FastifyRequest, reply: FastifyReply) {
    this.defaultErrorLog(error, request, reply);
  }
}
