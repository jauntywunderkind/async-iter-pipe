#!/usr/bin/env node
"use module"
import tape from "tape"
import Pipe, { PipeAbortError} from "../async-iter-pipe.js"

tape( "push then next", async function( t){
	t.plan( 1)
	const pipe= new Pipe()
	pipe.push( 20)
	const v1= pipe.next()
	t.deepEqual( await v1, { value: 20, done: false}, "gets 20")
	t.end()
})
tape( "push then next, x2", async function( t){
	t.plan( 2)
	const pipe= new Pipe()

	pipe.push( 10)
	const v1= pipe.next()
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")

	pipe.push( 20)
	const v2= pipe.next()
	t.deepEqual( await v2, { value: 20, done: false}, "gets 20")

	t.end()
})
tape( "push x2 the nnext x2", async function( t){
	t.plan( 2)
	const pipe= new Pipe()
	pipe.push( 10)
	pipe.push( 20)
	const
	  v1= pipe.next(),
	  v2= pipe.next()
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")
	t.deepEqual( await v2, { value: 20, done: false}, "gets 20")
	t.end()
})
