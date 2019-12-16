#!/usr/bin/env node
"use module"
/** module .test/signal.js
* test for termination signals
*/
import tape from "tape"
import Pipe, { PipeAbortError} from "../async-iter-pipe.js"

// thenDone can be called with or without handlers, returning a promise either way
// thenDone should work whether it is used before or after becoming done
tape( "thenDone-promise then return", async function( t){
	t.plan( 1)
	const
	  pipe= new Pipe(),
	  done= pipe.thenDone()
	pipe.return()
	const empty= await done
	t.equal( empty, undefined, "became done")
	t.end()
})
tape( "thenDone-then then return", async function( t){
	t.plan( 2)
	const
	  pipe= new Pipe(),
	  done= pipe.thenDone( function( empty){
		t.equal( empty, undefined, "handler called")
		return "ping"
	  })
	pipe.return()
	t.equal( await done, "ping", "handler returned ping")
	t.end()
})
tape( "return then thenDone-promise", async function( t){
	t.plan( 1)
	const pipe= new Pipe()
	pipe.return()
	const empty= await pipe.thenDone()
	t.equal( empty, undefined, "became done")
	t.end()
})
tape( "return then thenDone-then", async function( t){
	t.plan( 2)
	const pipe= new Pipe()
	pipe.return()
	const done= pipe.thenDone( function( empty){
		t.equal( empty, undefined, "became done")
		return "ping"
	})
	t.equal( await done, "ping", "handler returned ping")
	t.end()
})

tape( "thenDone throws after abort", async function( t){
	t.plan( 1)
	const pipe= new Pipe()
	pipe.abort()
	const done= pipe.thenDone( function(){
		t.fail( "should have thrown")
	}, function( ex){
		t.ok( ex instanceof PipeAbortError, "got an abort")
		t.end()
	})
})
tape( "thenDone throws on abort", async function( t){
	t.plan( 1)
	const pipe= new Pipe()
	const done= pipe.thenDone( function(){
		t.fail( "should have thrown")
	}, function( ex){
		t.ok( ex instanceof PipeAbortError, "got an abort")
		t.end()
	})
	pipe.abort()
})
