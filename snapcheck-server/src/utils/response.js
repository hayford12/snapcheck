function ok(res, data, message, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    ...(message && { message }),
    ...(data !== undefined && { data }),
  })
}
function created(res, data, message = 'Created successfully') { return ok(res, data, message, 201) }
function fail(res, message, statusCode = 400, errors = null) {
  return res.status(statusCode).json({ success: false, message, ...(errors && { errors }) })
}
function unauthorized(res, message = 'Unauthorized')              { return fail(res, message, 401) }
function forbidden(res, message = 'Insufficient permissions')     { return fail(res, message, 403) }
function notFound(res, message = 'Not found')                     { return fail(res, message, 404) }
function serverError(res, message = 'Internal server error')      { return fail(res, message, 500) }
module.exports = { ok, created, fail, unauthorized, forbidden, notFound, serverError }
