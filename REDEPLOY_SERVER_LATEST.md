-----------------------------------------------------------------------------------------------------------
				DOCKER IMAGE OR SERVER REDPLOY LATEST
-----------------------------------------------------------------------------------------------------------
1. Go to your backend project
cmd: cd path/to/backend

-----------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------
2. Build a new image

Replace the image name with yours:

cmd: docker build -t shadyplant-server .

Verify:

cmd: docker images
-----------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------
3. Login to Amazon ECR

Get the login command from AWS:

cmd: aws ecr get-login-password --region ap-south-2 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-2.amazonaws.com

For your account:

cmd: aws ecr get-login-password --region ap-south-2 | docker login --username AWS --password-stdin 487442499592.dkr.ecr.ap-south-2.amazonaws.com
-----------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------
4. Tag the image

Example:

cmd: docker tag shadyplant-api:latest 487442499592.dkr.ecr.ap-south-2.amazonaws.com/shadyplant-server:latest

Or use a version tag:

docker tag shadyplant-api:latest 487442499592.dkr.ecr.ap-south-2.amazonaws.com/shadyplant-server:v2
-----------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------

5. Push to ECR
cmd: docker push 487442499592.dkr.ecr.ap-south-2.amazonaws.com/shadyplant-server:latest

or

docker push 487442499592.dkr.ecr.ap-south-2.amazonaws.com/shadyplant-server:v2
-----------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------

6. Force ECS deployment

Go to:

ECS → Cluster → Service → Update Service

Check:

Force new deployment

Then:

Update Service

ECS will pull the new image and start fresh tasks.

-----------------------------------------------------------------------------------------------------------
						END
-----------------------------------------------------------------------------------------------------------