const { v4: uuidv4 } = require('uuid');

function requestIdMiddleware(req, res, next) {
  const incoming = req.get('x-request-id');
  const id = incoming && incoming.length <= 128 ? incoming : uuidv4();

  req.requestId = id;
  res.setHeader('X-Request-ID', id);

  next();
}

module.exports = { requestIdMiddleware };
