import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserCreationRequest } from './user-creation-request';

describe('UserCreationRequest', () => {
  let component: UserCreationRequest;
  let fixture: ComponentFixture<UserCreationRequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCreationRequest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserCreationRequest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
