#!/usr/bin/env node
// Prints, one per line, every route path of src/router/index.js that a copy of index.html can
// serve: no parameter, no catch-all, not "/" (the bucket's index document already serves that).
//
// Why it exists. The dashboard is a bucket website behind Scaleway Edge Services. On a key it
// does not hold, the bucket answers with its error document, index.html, under status 404, so
// every deep link rendered the app and reported Not Found. Neither the bucket nor Edge Services
// can rewrite a path or change a status (checked 2026-10-03: route rules only pick a backend
// stage), so the deploy writes index.html under each of these keys and the bucket finds them.
// Routes with a parameter cannot be enumerated and keep the 404 status; they still render.
//
// The router is read as a syntax tree rather than imported, because importing it imports every
// component. tests/e2e/public/static-routes.spec.js compares this list with the router the
// running app actually built, so the two cannot drift apart unnoticed.

const fs = require('fs')
const path = require('path')
const { parse } = require('@babel/parser')

const ROUTER = path.join(__dirname, '..', 'src', 'router', 'index.js')

function routesArray(ast) {
  for (const node of ast.program.body) {
    if (node.type !== 'VariableDeclaration') continue
    for (const decl of node.declarations) {
      if (decl.id.name === 'routes' && decl.init && decl.init.type === 'ArrayExpression') return decl.init
    }
  }
  throw new Error(`${ROUTER}: no "const routes = [...]" at top level`)
}

function property(obj, name) {
  return obj.properties.find(p => p.type === 'ObjectProperty' && !p.computed &&
    (p.key.name === name || p.key.value === name))
}

/** Every path declared in the routes array, children joined to their parent. */
function declaredPaths(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['dynamicImport'] })
  const out = []
  const walk = (array, prefix) => {
    for (const el of array.elements) {
      if (!el || el.type !== 'ObjectExpression') {
        throw new Error(`${ROUTER}: a route that is not an object literal cannot be read statically`)
      }
      const p = property(el, 'path')
      if (!p || p.value.type !== 'StringLiteral') {
        throw new Error(`${ROUTER}: a route whose path is not a string literal cannot be read statically`)
      }
      const full = p.value.value.startsWith('/') ? p.value.value : `${prefix.replace(/\/$/, '')}/${p.value.value}`
      out.push(full)
      const children = property(el, 'children')
      if (children && children.value.type === 'ArrayExpression') walk(children.value, full)
    }
  }
  walk(routesArray(ast), '')
  return out
}

function isStatic(p) {
  return p !== '/' && !p.includes(':') && !p.includes('*')
}

function staticRoutes(source = fs.readFileSync(ROUTER, 'utf8')) {
  return [...new Set(declaredPaths(source).filter(isStatic))].sort()
}

module.exports = { declaredPaths, staticRoutes, isStatic }

if (require.main === module) {
  const routes = staticRoutes()
  if (routes.length === 0) {
    console.error(`${ROUTER}: no static routes found`)
    process.exit(1)
  }
  process.stdout.write(routes.join('\n') + '\n')
}
