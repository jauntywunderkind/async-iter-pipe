#!/usr/bin/env node
"use module"
import tape from "tape"
import Pipe, { PipeAbortError} from "../async-iter-pipe.js"

tape( "next then push", async function( t){
	t.plan( 1)
	const
	  pipe= new Pipe(),
	  v1= pipe.next()
	pipe.push( 10)
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")
	t.end()
})
tape( "next then push, x2", async function( t){
	t.plan( 2)
	const pipe= new Pipe()

	const v1= pipe.next()
	pipe.push( 10)
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")

	const v2= pipe.next()
	pipe.push( 20)
	t.deepEqual( await v2, { value: 20, done: false}, "gets 20")
	t.end()
})
tape( "next x2 then push x2", async function( t){
	t.plan( 2)
	const
	  pipe= new Pipe(),
	  v1= pipe.next(),
	  v2= pipe.next()
	pipe.push( 10)
	pipe.push( 20)
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")
	t.deepEqual( await v2, { value: 20, done: false}, "gets 20")
	t.end()

})
